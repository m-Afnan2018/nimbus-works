import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import User from '../models/User';
import Room from '../models/Room';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import UserChatSettings from '../models/UserChatSettings';
import mongoose from 'mongoose';
import { sendPushToUser } from '../utils/webPush';
import { isDemoMode } from '../middleware/demo.middleware';
import { createLimiter, clientIp, trustProxyHops } from '../middleware/rateLimit';

// Demo: chat writes per visitor IP (demo logins are shared, so not per user).
const demoChatLimiter = createLimiter(20, 60_000);
const DEMO_CHAT_EVENTS = new Set(['send_message', 'add_reaction', 'pin_message']);

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
}

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

function addOnline(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

function removeOnline(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

let ioInstance: SocketServer | null = null;
export function getIO(): SocketServer | null { return ioInstance; }

/** Make every active socket belonging to a user join a Socket.io room immediately. */
export function addUserToRoom(userId: string, roomId: string): void {
  const socketIds = onlineUsers.get(userId);
  if (!socketIds || !ioInstance) return;
  for (const socketId of socketIds) {
    const sock = ioInstance.sockets.sockets.get(socketId);
    sock?.join(roomId);
  }
}

function mapRooms(rooms: any[]): object[] {
  return rooms.map((room) => ({
    _id: room._id.toString(),
    name: room.name,
    createdBy: room.createdBy
      ? { _id: (room.createdBy._id ?? room.createdBy).toString(), name: room.createdBy.name, avatar: room.createdBy.avatar }
      : null,
    participants: (room.participants ?? []).map((p: any) => ({
      user: {
        _id: (p.user?._id ?? p.user).toString(),
        name: p.user?.name ?? '',
        avatar: p.user?.avatar ?? null,
        role: p.user?.role ?? 'member',
      },
      joinedAt: p.joinedAt,
    })),
    maxParticipants: room.maxParticipants,
    createdAt: room.createdAt,
  }));
}

export function initSocket(httpServer: HttpServer): SocketServer {
  // Support comma-separated origins e.g. "http://localhost:3000,https://demo.example.com"
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map((o) => o.trim());

  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    },
    // Allow both WebSocket and long-polling so the connection can fall back
    transports: ['websocket', 'polling'],
    // Public demo: chat is text-only (uploads are blocked), so keep frames small.
    ...(isDemoMode() && { maxHttpBufferSize: 100_000 }),
  });

  // JWT auth middleware
  ioInstance = io;

  // Clear stale voice room participants from previous server run
  Room.updateMany({}, { $set: { participants: [] } }).catch(() => {});

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = verifyAccessToken(token);
      (socket as AuthenticatedSocket).userId   = decoded.id;
      (socket as AuthenticatedSocket).userName = decoded.name;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const s = socket as AuthenticatedSocket;
    const userId = s.userId;

    // Public demo: socket events skip the HTTP demoGuard, so apply the same idea here.
    // Voice rooms are off (strangers calling strangers, plus WebRTC needs a TURN
    // server), and chat writes are rate-limited per visitor IP.
    if (isDemoMode()) {
      const ip = clientIp(socket.handshake.headers['x-forwarded-for'], socket.handshake.address, trustProxyHops());
      socket.use(([event], next) => {
        if (event.startsWith('voice:')) {
          if (event === 'voice:join') socket.emit('voice:error', { message: 'Voice rooms are disabled in the demo.' });
          return;
        }
        if (DEMO_CHAT_EVENTS.has(event) && !demoChatLimiter(ip)) return;
        next();
      });
    }

    // Track online presence
    addOnline(userId, socket.id);

    // Auto-join all conversation rooms for this user
    const conversations = await Conversation.find({ participants: userId }).select('_id');
    for (const conv of conversations) {
      socket.join(conv._id.toString());
    }

    // Tell everyone else this user is now online
    socket.broadcast.emit('user_online', { userId });

    // Tell the connecting user who is already online
    socket.emit('online_users', { userIds: Array.from(onlineUsers.keys()) });

    // ── join_conversation ─────────────────────────────────────────
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      const conv = await Conversation.findOne({
        _id: data.conversationId,
        participants: userId,
      });
      if (conv) socket.join(data.conversationId);
    });

    // ── send_message ──────────────────────────────────────────────
    socket.on('send_message', async (data: {
      conversationId: string;
      content: string;
      type?: string;
      attachments?: object[];
      replyTo?: string;
    }) => {
      try {
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          participants: userId,
        });
        if (!conv) return;

        const msg = await Message.create({
          conversation: conv._id,
          sender: userId,
          type: data.type || 'text',
          content: data.content?.trim() ?? '',
          attachments: data.attachments || [],
          replyTo: data.replyTo || undefined,
        });

        await msg.populate({ path: 'sender', model: User, select: 'name email avatar' });
        if (data.replyTo) {
          await msg.populate({ path: 'replyTo', model: Message, populate: { path: 'sender', model: User, select: 'name avatar' } });
        }

        conv.lastMessage  = msg._id as any;
        conv.lastActivity = new Date();
        await conv.save();

        // Broadcast to everyone in the room (including sender for confirmation)
        io.to(data.conversationId).emit('new_message', msg);

        // Push notification to participants who are offline right now
        try {
          const preview = data.content?.trim()
            ? data.content.length > 60 ? data.content.substring(0, 60) + '…' : data.content
            : '📎 Attachment';

          const offlineParticipants = conv.participants
            .map((p) => p.toString())
            .filter((pid) => pid !== userId && !isUserOnline(pid));

          await Promise.all(
            offlineParticipants.map((pid) =>
              sendPushToUser(pid, {
                title: s.userName || 'New Message',
                body:  preview,
                url:   '/chat',
              }).catch(() => {}),
            ),
          );
        } catch {} // push failures must never break message delivery
      } catch (err) {
        console.error('[Socket] send_message error:', err);
      }
    });

    // ── typing ────────────────────────────────────────────────────
    socket.on('typing_start', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId,
        userName: s.userName,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_stopped_typing', {
        userId,
        conversationId: data.conversationId,
      });
    });

    // ── mark_seen ─────────────────────────────────────────────────
    socket.on('mark_seen', async (data: { conversationId: string }) => {
      try {
        await UserChatSettings.findOneAndUpdate(
          { user: userId, conversation: data.conversationId },
          { $set: { lastReadAt: new Date() } },
          { upsert: true },
        );
        // Use io.to (not socket.to) so the sender also gets the event
        // and can update their message ticks to blue
        io.to(data.conversationId).emit('messages_seen', {
          conversationId: data.conversationId,
          userId,
          seenAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket] mark_seen error:', err);
      }
    });

    // ── add_reaction ──────────────────────────────────────────────
    socket.on('add_reaction', async (data: { messageId: string; emoji: string }) => {
      try {
        const msg = await Message.findById(data.messageId);
        if (!msg) return;

        const existing = msg.reactions.find((r) => r.emoji === data.emoji);
        if (existing) {
          const idx = existing.users.findIndex((u) => u.toString() === userId);
          if (idx === -1) existing.users.push(new mongoose.Types.ObjectId(userId));
          else {
            existing.users.splice(idx, 1);
            if (existing.users.length === 0) {
              msg.reactions = msg.reactions.filter((r) => r.emoji !== data.emoji) as any;
            }
          }
        } else {
          msg.reactions.push({ emoji: data.emoji, users: [new mongoose.Types.ObjectId(userId)] });
        }

        await msg.save();
        await msg.populate({ path: 'sender', model: User, select: 'name email avatar' });

        const conv = msg.conversation.toString();
        io.to(conv).emit('message_updated', msg);
      } catch (err) {
        console.error('[Socket] add_reaction error:', err);
      }
    });

    // ── pin_message ───────────────────────────────────────────────
    socket.on('pin_message', async (data: { conversationId: string; messageId: string; pin: boolean }) => {
      try {
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          participants: userId,
        });
        if (!conv) return;

        if (data.pin) {
          if (conv.pinnedMessages.length >= 3) return;
          const alreadyPinned = conv.pinnedMessages.some((p) => p.toString() === data.messageId);
          if (!alreadyPinned) {
            conv.pinnedMessages.push(new mongoose.Types.ObjectId(data.messageId));
          }
        } else {
          conv.pinnedMessages = conv.pinnedMessages.filter((p) => p.toString() !== data.messageId) as any;
        }

        await conv.save();

        const populated = await Conversation.findById(conv._id)
          .populate({ path: 'participants', model: User, select: 'name email avatar role lastSeen' })
          .populate({ path: 'pinnedMessages', model: Message, populate: { path: 'sender', model: User, select: 'name' } });

        io.to(data.conversationId).emit('conversation_updated', populated);
      } catch (err) {
        console.error('[Socket] pin_message error:', err);
      }
    });

    // ── Voice Rooms (WebRTC signaling) ────────────────────────────
    socket.on('voice:join', async ({ roomId }: { roomId: string }) => {
      try {
        // Leave any other room the user is currently in
        const prevRoom = await Room.findOne({
          'participants.user': new mongoose.Types.ObjectId(userId),
          _id: { $ne: roomId },
        });
        if (prevRoom) {
          await Room.findByIdAndUpdate(prevRoom._id, {
            $pull: { participants: { user: new mongoose.Types.ObjectId(userId) } },
          });
          socket.leave(`voice:${prevRoom._id}`);
          io.to(`voice:${prevRoom._id}`).emit('voice:user_left', { userId });
        }

        const room = await Room.findById(roomId);
        if (!room) { socket.emit('voice:error', { message: 'Room not found.' }); return; }
        if (room.participants.length >= room.maxParticipants) {
          socket.emit('voice:error', { message: 'Room is full.' }); return;
        }

        const alreadyIn = room.participants.some((p) => p.user.toString() === userId);
        if (!alreadyIn) {
          room.participants.push({ user: new mongoose.Types.ObjectId(userId), joinedAt: new Date() } as any);
          await room.save();
        }

        socket.join(`voice:${roomId}`);

        // Send current participants to the joiner
        const populated = await Room.findById(roomId).populate({ path: 'participants.user', model: User, select: 'name avatar role' });
        const participants = (populated?.participants ?? []).map((p: any) => ({
          _id: (p.user._id || p.user).toString(),
          name: p.user.name,
          avatar: p.user.avatar,
          role: p.user.role,
        }));
        socket.emit('voice:room_state', { roomId, participants });

        // Notify others already in the room
        const joiner = await User.findById(userId).select('name avatar role');
        socket.to(`voice:${roomId}`).emit('voice:user_joined', {
          user: { _id: userId, name: joiner?.name, avatar: joiner?.avatar, role: joiner?.role },
        });

        // Broadcast updated room list to everyone
        const allRooms = await Room.find()
          .populate({ path: 'createdBy', model: User, select: 'name avatar' })
          .populate({ path: 'participants.user', model: User, select: 'name avatar role' });
        io.emit('voice:rooms_updated', mapRooms(allRooms));
      } catch (err) {
        console.error('[Socket] voice:join error:', err);
      }
    });

    socket.on('voice:leave', async ({ roomId }: { roomId: string }) => {
      try {
        await Room.findByIdAndUpdate(roomId, {
          $pull: { participants: { user: new mongoose.Types.ObjectId(userId) } },
        });
        socket.leave(`voice:${roomId}`);
        io.to(`voice:${roomId}`).emit('voice:user_left', { userId });

        const allRooms = await Room.find()
          .populate({ path: 'createdBy', model: User, select: 'name avatar' })
          .populate({ path: 'participants.user', model: User, select: 'name avatar role' });
        io.emit('voice:rooms_updated', mapRooms(allRooms));
      } catch (err) {
        console.error('[Socket] voice:leave error:', err);
      }
    });

    // ── Voice room invite ─────────────────────────────────────────
    socket.on('voice:invite', async ({ roomId, roomName, toUserId }: { roomId: string; roomName: string; toUserId: string }) => {
      try {
        const targets = onlineUsers.get(toUserId);
        if (!targets) return;
        const inviter = await User.findById(userId).select('name avatar');
        const payload = {
          from: { id: userId, name: inviter?.name ?? s.userName, avatar: inviter?.avatar ?? null },
          roomId,
          roomName,
        };
        for (const sid of targets) io.to(sid).emit('voice:invite_received', payload);
      } catch (err) {
        console.error('[Socket] voice:invite error:', err);
      }
    });

    // Relay WebRTC signals between peers (server never inspects the SDP/ICE content)
    socket.on('voice:offer', ({ to, sdp }: { to: string; sdp: object }) => {
      const targets = onlineUsers.get(to);
      if (!targets) return;
      for (const sid of targets) io.to(sid).emit('voice:offer', { from: userId, sdp });
    });

    socket.on('voice:answer', ({ to, sdp }: { to: string; sdp: object }) => {
      const targets = onlineUsers.get(to);
      if (!targets) return;
      for (const sid of targets) io.to(sid).emit('voice:answer', { from: userId, sdp });
    });

    socket.on('voice:ice', ({ to, candidate }: { to: string; candidate: object }) => {
      const targets = onlineUsers.get(to);
      if (!targets) return;
      for (const sid of targets) io.to(sid).emit('voice:ice', { from: userId, candidate });
    });

    // ── disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      removeOnline(userId, socket.id);
      const lastSeen = new Date();
      // Only mark offline once all tabs are closed
      if (!onlineUsers.has(userId)) {
        User.findByIdAndUpdate(userId, { lastSeen }).catch(() => {});
        io.emit('user_offline', { userId, lastSeen: lastSeen.toISOString() });

        // Clean up voice room participation
        Room.find({ 'participants.user': new mongoose.Types.ObjectId(userId) })
          .then(async (rooms) => {
            for (const room of rooms) {
              await Room.findByIdAndUpdate(room._id, {
                $pull: { participants: { user: new mongoose.Types.ObjectId(userId) } },
              });
              io.to(`voice:${room._id}`).emit('voice:user_left', { userId });
            }
            if (rooms.length > 0) {
              const allRooms = await Room.find()
                .populate({ path: 'createdBy', model: User, select: 'name avatar' })
                .populate({ path: 'participants.user', model: User, select: 'name avatar role' });
              io.emit('voice:rooms_updated', mapRooms(allRooms));
            }
          })
          .catch(() => {});
      }
    });
  });

  return io;
}

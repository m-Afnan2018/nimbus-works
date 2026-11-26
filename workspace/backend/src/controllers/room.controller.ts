import { Request, Response } from 'express';
import Room from '../models/Room';
import User from '../models/User';

export const getRoomUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ isActive: true }).select('_id name avatar role').sort({ name: 1 });
    res.json(users.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      avatar: u.avatar ?? null,
      role: u.role,
    })));
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getRooms = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await Room.find()
      .populate({ path: 'createdBy', model: User, select: 'name avatar' })
      .populate({ path: 'participants.user', model: User, select: 'name avatar role' })
      .sort({ createdAt: -1 });
    const data = rooms.map((room) => ({
      _id: room._id.toString(),
      name: room.name,
      createdBy: room.createdBy
        ? {
            _id: ((room.createdBy as any)._id ?? room.createdBy).toString(),
            name: (room.createdBy as any).name,
            avatar: (room.createdBy as any).avatar,
          }
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
    res.json(data);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, maxParticipants } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Room name is required.' });
      return;
    }
    const room = await Room.create({
      name: name.trim(),
      createdBy: req.user?.id,
      maxParticipants: maxParticipants || 10,
    });
    await room.populate({ path: 'createdBy', model: User, select: 'name avatar' });
    res.status(201).json(room);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      res.status(404).json({ message: 'Room not found.' });
      return;
    }
    const isAdmin = req.user?.role === 'admin';
    const isCreator = room.createdBy.toString() === req.user?.id;
    if (!isAdmin && !isCreator) {
      res.status(403).json({ message: 'Not authorized.' });
      return;
    }
    await room.deleteOne();
    res.json({ message: 'Room deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

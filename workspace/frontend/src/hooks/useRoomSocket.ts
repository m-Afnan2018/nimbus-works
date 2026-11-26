'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from './useChatSocket';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore, RoomParticipant } from '@/store/roomStore';
import { useInviteStore } from '@/store/inviteStore';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [{
        urls: [process.env.NEXT_PUBLIC_TURN_URL!, process.env.NEXT_PUBLIC_TURN_URL_TLS!].filter(Boolean),
        username: process.env.NEXT_PUBLIC_TURN_USER!,
        credential: process.env.NEXT_PUBLIC_TURN_PASS!,
      }]
    : []),
];

let audioUnlocked = false;
function unlockAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const ctx = new AudioContext();
  ctx.resume().then(() => ctx.close()).catch(() => {});
  // Play a silent buffer so browser marks this context as user-activated
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

const log = (...args: any[]) => console.log('[ROOM]', ...args);
const err = (...args: any[]) => console.error('[ROOM ERROR]', ...args);

let localStream: MediaStream | null = null;
const peerConnections = new Map<string, RTCPeerConnection>();
const remoteAudios = new Map<string, HTMLAudioElement>();
const iceCandidateBuffer = new Map<string, RTCIceCandidateInit[]>();
const remoteSpeakingDetectors = new Map<string, () => void>();
let speakingCleanup: (() => void) | null = null;

function startRemoteSpeakingDetection(stream: MediaStream, peerId: string): () => void {
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    let active = true;
    let wasSpeaking = false;
    const tick = () => {
      if (!active) return;
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      const speaking = avg > 10;
      if (speaking !== wasSpeaking) {
        wasSpeaking = speaking;
        useRoomStore.getState().setParticipantSpeaking(peerId, speaking);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(rafId); ctx.close().catch(() => {}); };
  } catch {
    return () => {};
  }
}

function startLocalSpeakingDetection(stream: MediaStream): () => void {
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    let active = true;
    let wasSpeaking = false;
    const tick = () => {
      if (!active) return;
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      const speaking = avg > 15;
      if (speaking !== wasSpeaking) {
        wasSpeaking = speaking;
        const { isMuted } = useRoomStore.getState();
        useRoomStore.getState().setLocalSpeaking(speaking && !isMuted);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(rafId); ctx.close().catch(() => {}); };
  } catch {
    return () => {};
  }
}

function createPC(peerId: string): RTCPeerConnection {
  peerConnections.get(peerId)?.close();

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  const trackCount = localStream?.getTracks().length ?? 0;
  log(`createPC for ${peerId} — localStream exists: ${!!localStream}, tracks: ${trackCount}`);

  if (localStream) {
    localStream.getTracks().forEach((t) => {
      log(`  adding track: kind=${t.kind} enabled=${t.enabled} readyState=${t.readyState}`);
      pc.addTrack(t, localStream!);
    });
  } else {
    err('createPC called but localStream is NULL — remote side will hear nothing from us');
  }

  pc.onicecandidate = ({ candidate }) => {
    if (!candidate) { log(`ICE gathering complete for ${peerId}`); return; }
    log(`ICE candidate → ${peerId}:`, candidate.type, candidate.protocol);
    getSocket()?.emit('voice:ice', { to: peerId, candidate: candidate.toJSON() });
  };

  pc.onicecandidateerror = (e: any) => {
    err(`ICE candidate error for ${peerId}:`, e.errorText ?? e);
  };

  pc.oniceconnectionstatechange = () => {
    log(`ICE state [${peerId}]:`, pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    log(`Connection state [${peerId}]:`, pc.connectionState);
    if (pc.connectionState === 'failed') {
      err(`Connection FAILED for ${peerId} — giving up`);
      cleanupPeer(peerId);
      useRoomStore.getState().removeParticipant(peerId);
    }
  };

  pc.onsignalingstatechange = () => {
    log(`Signaling state [${peerId}]:`, pc.signalingState);
  };

  pc.ontrack = ({ track, streams }) => {
    log(`ontrack from ${peerId}: kind=${track.kind}, streams=${streams.length}`);

    let audio = remoteAudios.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      remoteAudios.set(peerId, audio);
      log(`Created <audio> element for ${peerId} and appended to body`);
    }

    let activeStream: MediaStream | null = null;
    if (streams && streams.length > 0) {
      audio.srcObject = streams[0];
      activeStream = streams[0];
      log(`Set srcObject from streams[0] for ${peerId}, tracks in stream: ${streams[0].getTracks().length}`);
    } else {
      const existing = audio.srcObject instanceof MediaStream ? audio.srcObject : new MediaStream();
      if (!existing.getTracks().includes(track)) existing.addTrack(track);
      audio.srcObject = existing;
      activeStream = existing;
      log(`Built MediaStream from track for ${peerId} (streams[] was empty)`);
    }

    // Start speaking detection on the remote stream
    if (activeStream) {
      remoteSpeakingDetectors.get(peerId)?.();
      remoteSpeakingDetectors.set(peerId, startRemoteSpeakingDetection(activeStream, peerId));
    }

    audio.play()
      .then(() => log(`Audio playing for ${peerId}`))
      .catch((e) => err(`Audio play() failed for ${peerId}:`, e));
  };

  peerConnections.set(peerId, pc);
  return pc;
}

function cleanupPeer(peerId: string) {
  peerConnections.get(peerId)?.close();
  peerConnections.delete(peerId);
  iceCandidateBuffer.delete(peerId);
  remoteSpeakingDetectors.get(peerId)?.();
  remoteSpeakingDetectors.delete(peerId);
  useRoomStore.getState().setParticipantSpeaking(peerId, false);
  const audio = remoteAudios.get(peerId);
  if (audio) { audio.srcObject = null; audio.remove(); remoteAudios.delete(peerId); }
  log(`Cleaned up peer ${peerId}`);
}

async function flushIceCandidates(peerId: string, pc: RTCPeerConnection) {
  const buffered = iceCandidateBuffer.get(peerId) ?? [];
  iceCandidateBuffer.delete(peerId);
  if (buffered.length > 0) log(`Flushing ${buffered.length} buffered ICE candidates for ${peerId}`);
  for (const c of buffered) {
    try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { err('addIceCandidate failed:', e); }
  }
}

export async function joinRoom(roomId: string, roomName: string): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');

  log(`joinRoom: ${roomName} (${roomId})`);

  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  speakingCleanup?.();

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });

  log(`Got mic stream — tracks: ${localStream.getTracks().map(t => `${t.kind}(${t.readyState})`).join(', ')}`);

  unlockAudio();
  speakingCleanup = startLocalSpeakingDetection(localStream);
  useRoomStore.getState().setActiveRoom(roomId, roomName);
  socket.emit('voice:join', { roomId });
  log(`Emitted voice:join`);
}

export function leaveRoom(): void {
  const socket = getSocket();
  const { activeRoomId, clearActiveRoom } = useRoomStore.getState();
  log(`leaveRoom: ${activeRoomId}`);
  if (activeRoomId) socket?.emit('voice:leave', { roomId: activeRoomId });
  peerConnections.forEach((pc) => pc.close());
  peerConnections.clear();
  iceCandidateBuffer.clear();
  remoteSpeakingDetectors.forEach((stop) => stop());
  remoteSpeakingDetectors.clear();
  remoteAudios.forEach((a) => { a.srcObject = null; a.remove(); });
  remoteAudios.clear();
  speakingCleanup?.();
  speakingCleanup = null;
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  clearActiveRoom();
}

export function toggleMute(): void {
  const { isMuted, setMuted } = useRoomStore.getState();
  const next = !isMuted;
  setMuted(next);
  localStream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  if (next) useRoomStore.getState().setLocalSpeaking(false);
  log(`Mute toggled: ${next}`);
}

export function useRoomSocket() {
  const userId = useAuthStore((s) => s.user?.id);
  const { setParticipants, addParticipant, removeParticipant } = useRoomStore();
  const listenersRegistered = useRef(false);

  useEffect(() => {
    if (!userId || listenersRegistered.current) return;
    listenersRegistered.current = true;
    log(`Registering socket listeners for userId=${userId}`);

    const attach = () => {
      const socket = getSocket();
      if (!socket) { log('Socket not ready, retrying in 500ms...'); setTimeout(attach, 500); return; }
      log('Socket found, attaching voice listeners');

      socket.on('voice:room_state', async ({ participants }: { participants: RoomParticipant[] }) => {
        log(`voice:room_state — total participants: ${participants.length}`, participants.map(p => p._id));
        const others = participants.filter((p) => p._id !== userId);
        log(`Others in room (excluding self): ${others.length}`, others.map(p => p.name));
        setParticipants(others);

        for (const peer of others) {
          log(`Creating offer for peer: ${peer.name} (${peer._id})`);
          const pc = createPC(peer._id);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            log(`Offer created for ${peer._id}, sending...`);
            socket.emit('voice:offer', { to: peer._id, sdp: pc.localDescription });
          } catch (e) {
            err(`createOffer failed for ${peer._id}:`, e);
          }
        }
      });

      socket.on('voice:user_joined', ({ user }: { user: RoomParticipant }) => {
        log(`voice:user_joined: ${user.name} (${user._id})`);
        if (user._id !== userId) addParticipant(user);
      });

      socket.on('voice:user_left', ({ userId: leftId }: { userId: string }) => {
        log(`voice:user_left: ${leftId}`);
        removeParticipant(leftId);
        cleanupPeer(leftId);
      });

      socket.on('voice:offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        const { activeRoomId } = useRoomStore.getState();
        log(`voice:offer from ${from} — activeRoomId=${activeRoomId}`);
        if (!activeRoomId) { err('Received offer but not in a room — ignoring'); return; }

        const pc = createPC(from);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          log(`Set remote description (offer) from ${from}`);
          await flushIceCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          log(`Answer created for ${from}, sending...`);
          socket.emit('voice:answer', { to: from, sdp: pc.localDescription });
        } catch (e) {
          err(`Handle offer from ${from} failed:`, e);
        }
      });

      socket.on('voice:answer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        log(`voice:answer from ${from}`);
        const pc = peerConnections.get(from);
        if (!pc) { err(`No PC found for ${from} when receiving answer`); return; }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          log(`Set remote description (answer) from ${from}`);
          await flushIceCandidates(from, pc);
        } catch (e) {
          err(`Handle answer from ${from} failed:`, e);
        }
      });

      socket.on('voice:ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnections.get(from);
        if (!pc || !pc.remoteDescription) {
          if (!iceCandidateBuffer.has(from)) iceCandidateBuffer.set(from, []);
          iceCandidateBuffer.get(from)!.push(candidate);
          log(`Buffered ICE candidate from ${from} (PC not ready yet, total buffered: ${iceCandidateBuffer.get(from)!.length})`);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          log(`Added ICE candidate from ${from}`);
        } catch (e) { err('addIceCandidate error:', e); }
      });

      socket.on('voice:error', ({ message }: { message: string }) => {
        err('Server error:', message);
        alert(`Voice room: ${message}`);
        leaveRoom();
      });

      socket.on('voice:invite_received', ({ from, roomId, roomName }: {
        from: { id: string; name: string; avatar?: string | null };
        roomId: string;
        roomName: string;
      }) => {
        log(`voice:invite_received from ${from.name} for room ${roomName}`);
        useInviteStore.getState().addInvite({
          id: crypto.randomUUID(),
          from,
          roomId,
          roomName,
          receivedAt: Date.now(),
        });
      });
    };

    attach();
  }, [userId]);
}

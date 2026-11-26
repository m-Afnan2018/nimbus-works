'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Avatar from '@/components/ui/Avatar/Avatar';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { joinRoom, leaveRoom } from '@/hooks/useRoomSocket';
import api from '@/lib/api';
import type { VoiceRoom } from '@/types';
import styles from './rooms.module.css';
import { Mic, MicOff, Volume2, Plus, Trash2, Users, LogIn, LogOut, Radio } from 'lucide-react';
import { getSocket } from '@/hooks/useChatSocket';

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function avatarSrc(avatar?: string) {
  if (!avatar) return undefined;
  return avatar.startsWith('http') ? avatar : `${STATIC_BASE}${avatar}`;
}

export default function RoomsPage() {
  const user = useAuthStore((s) => s.user);
  const { activeRoomId, isMuted, isSpeaking, participants: storeParticipants } = useRoomStore();

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Real-time updates when anyone joins or leaves
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = (updatedRooms: VoiceRoom[]) => setRooms(updatedRooms);
    socket.on('voice:rooms_updated', onUpdate);
    return () => { socket.off('voice:rooms_updated', onUpdate); };
  }, []);

  const handleJoin = async (room: VoiceRoom) => {
    setMicError(null);
    if (activeRoomId === room._id) { leaveRoom(); return; }
    setJoining(room._id);
    try {
      await joinRoom(room._id, room.name);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone access in your browser settings.'
        : err?.name === 'NotFoundError'
        ? 'No microphone detected. Please connect a microphone and try again.'
        : 'Could not access microphone. Check your browser permissions.';
      setMicError(msg);
    } finally {
      setJoining(null);
    }
  };

  const handleCreate = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      await api.post('/rooms', { name: newRoomName.trim() });
      setNewRoomName('');
      setShowCreate(false);
      await fetchRooms();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeRoomId === roomId) leaveRoom();
    try {
      await api.delete(`/rooms/${roomId}`);
      setRooms((prev) => prev.filter((r) => r._id !== roomId));
    } catch {
      // ignore
    }
  };

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  const userId = user?.id;

  return (
    <AppShell title="Voice Rooms">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Radio size={22} className={styles.headerIcon} />
            <div>
              <h1 className={styles.title}>Voice Rooms</h1>
              <p className={styles.subtitle}>Join a room to talk with your team — audio only, real-time</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} style={{ marginRight: '0.375rem' }} />
            Create Room
          </Button>
        </div>

        {micError && (
          <div className={styles.micError} onClick={() => setMicError(null)}>
            🎤 {micError}
            <span className={styles.micErrorDismiss}>✕</span>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingState}><Spinner /></div>
        ) : rooms.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><Volume2 size={52} strokeWidth={1.2} /></div>
            <h3 className={styles.emptyTitle}>No voice rooms yet</h3>
            <p className={styles.emptyDesc}>Create a room to start a voice conversation with your team.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} style={{ marginRight: '0.375rem' }} />
              Create First Room
            </Button>
          </div>
        ) : (
          <div className={styles.grid}>
            {rooms.map((room) => {
              const isActive = activeRoomId === room._id;
              const participants = room.participants ?? [];
              const isFull = participants.length >= room.maxParticipants;
              const createdById = typeof room.createdBy === 'object' ? (room.createdBy as any)._id : room.createdBy;
              const canDelete = isAdminOrManager || createdById === userId;
              const isJoining = joining === room._id;

              return (
                <div key={room._id} className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
                  {/* Card header */}
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleRow}>
                      <div className={`${styles.roomIcon} ${isActive ? styles.roomIconActive : ''}`}>
                        {isActive ? (
                          <span className={styles.liveRing} />
                        ) : null}
                        <Volume2 size={16} />
                      </div>
                      <span className={styles.cardName}>{room.name}</span>
                      {isActive && isSpeaking && !isMuted && (
                        <span className={styles.speakingPill}>speaking</span>
                      )}
                    </div>
                    <div className={styles.cardActions}>
                      <span className={styles.participantCount}>
                        <Users size={12} />
                        {participants.length}/{room.maxParticipants}
                      </span>
                      {canDelete && (
                        <button className={styles.deleteBtn} onClick={(e) => handleDelete(room._id, e)} title="Delete room">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Participants list */}
                  <div className={styles.participantsList}>
                    {participants.length === 0 ? (
                      <span className={styles.emptyRoom}>Empty — be the first to join</span>
                    ) : (
                      participants.map((p) => {
                        const uid = p.user._id ?? (p.user as any).id ?? '';
                        const isSelf = uid === userId;
                        const displayName = p.user.name || 'Unknown';
                        const storePeer = storeParticipants.find((sp) => sp._id === uid);
                        const speaking = isActive && (isSelf
                          ? (isSpeaking && !isMuted)
                          : (storePeer?.isSpeaking ?? false));
                        return (
                          <div key={uid || displayName} className={`${styles.participant} ${isSelf ? styles.participantSelf : ''}`}>
                            <div className={`${styles.participantAvatar} ${speaking ? styles.participantAvatarSpeaking : ''}`}>
                              {p.user.avatar ? (
                                <img src={avatarSrc(p.user.avatar)} alt={displayName} className={styles.participantImg} />
                              ) : (
                                <Avatar name={displayName} size="sm" />
                              )}
                              {!speaking && <span className={styles.onlineDot} />}
                            </div>
                            <span className={styles.participantName}>
                              {isSelf ? 'You' : displayName}
                            </span>
                            {speaking && <span className={styles.speakingWave}>speaking</span>}
                            {isSelf && isActive && !speaking && (
                              isMuted
                                ? <MicOff size={11} className={styles.mutedIcon} />
                                : <Mic size={11} className={styles.micOnIcon} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Join / Leave */}
                  <div className={styles.cardFooter}>
                    {isActive ? (
                      <button className={styles.leaveBtn} onClick={() => leaveRoom()}>
                        <LogOut size={14} />
                        Leave Room
                      </button>
                    ) : (
                      <button
                        className={styles.joinBtn}
                        onClick={() => handleJoin(room)}
                        disabled={isFull || !!isJoining}
                      >
                        {isJoining ? <Spinner size="sm" /> : <LogIn size={14} />}
                        <span>{isJoining ? 'Connecting…' : isFull ? 'Room Full' : 'Join Room'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setNewRoomName(''); }}
        title="Create Voice Room"
        size="sm"
      >
        <div className={styles.createForm}>
          <label className={styles.createLabel}>Room Name</label>
          <input
            className={styles.createInput}
            placeholder="e.g. General, Design Sync, Stand-up…"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            maxLength={100}
          />
          <div className={styles.createActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setNewRoomName(''); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newRoomName.trim() || creating}>
              {creating ? 'Creating…' : 'Create Room'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

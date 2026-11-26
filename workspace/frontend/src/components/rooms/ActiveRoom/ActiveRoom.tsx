'use client';

import { useRoomStore } from '@/store/roomStore';
import { leaveRoom, toggleMute } from '@/hooks/useRoomSocket';
import { useAuthStore } from '@/store/authStore';
import Avatar from '@/components/ui/Avatar/Avatar';
import styles from './ActiveRoom.module.css';
import { Mic, MicOff, PhoneOff, UserPlus, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import InviteModal from '../InviteModal/InviteModal';

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function avatarSrc(avatar?: string) {
  if (!avatar) return undefined;
  return avatar.startsWith('http') ? avatar : `${STATIC_BASE}${avatar}`;
}

interface ActiveRoomProps {
  collapsed?: boolean;
}

export default function ActiveRoom({ collapsed }: ActiveRoomProps) {
  const { activeRoomId, activeRoomName, participants, isMuted, isSpeaking } = useRoomStore();
  const user = useAuthStore((s) => s.user);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!activeRoomId) return null;

  const selfParticipant = {
    _id: user?.id ?? '',
    name: user?.name ?? '',
    avatar: user?.avatar,
    isSpeaking: isSpeaking && !isMuted,
  };
  const allParticipants = [selfParticipant, ...participants.filter((p) => p._id !== user?.id)];
  const speaking = isSpeaking && !isMuted;

  if (collapsed) {
    return (
      <div
        className={styles.barCollapsed}
        data-label={`Voice: ${activeRoomName}`}
      >
        <div className={`${styles.collapsedIcon} ${speaking ? styles.collapsedIconSpeaking : ''}`}>
          <Volume2 size={14} />
        </div>
      </div>
    );
  }

  const statusText = speaking ? 'Speaking…' : isMuted ? 'Mic muted' : 'Connected';

  return (
    <div className={styles.bar}>
      {/* Live header */}
      <div className={styles.header}>
        <span className={styles.liveDot} />
        <span className={styles.headerLabel}>Voice Connected</span>
        <span className={styles.peopleCount}>{allParticipants.length} in room</span>
      </div>

      {/* Room name + controls */}
      <div className={styles.roomRow}>
        <div className={`${styles.voiceIcon} ${speaking ? styles.voiceIconSpeaking : ''}`}>
          <Volume2 size={13} />
        </div>
        <div className={styles.roomText}>
          <Link href="/rooms" className={styles.roomName}>{activeRoomName}</Link>
          <span className={`${styles.roomStatus} ${speaking ? styles.roomStatusSpeaking : ''}`}>
            {statusText}
          </span>
        </div>
        <div className={styles.controls}>
          <button
            className={`${styles.btn} ${styles.btnInvite}`}
            onClick={() => setInviteOpen(true)}
            title="Invite someone"
          >
            <UserPlus size={13} />
          </button>
          <button
            className={`${styles.btn} ${isMuted ? styles.btnMuted : styles.btnMic}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
          <button
            className={`${styles.btn} ${styles.btnLeave}`}
            onClick={leaveRoom}
            title="Leave room"
          >
            <PhoneOff size={13} />
          </button>
        </div>
      </div>

      {/* Overlapping participant avatars */}
      <div className={styles.avatarsRow}>
        {allParticipants.slice(0, 7).map((p, i) => (
          <div
            key={p._id}
            className={`${styles.avatar} ${p.isSpeaking ? styles.avatarSpeaking : ''}`}
            style={{ zIndex: allParticipants.length - i }}
            title={`${p._id === user?.id ? 'You' : p.name}${p.isSpeaking ? ' · speaking' : ''}`}
          >
            <div className={styles.avatarInner}>
              {p.avatar ? (
                <img src={avatarSrc(p.avatar)} alt={p.name} className={styles.avatarImg} />
              ) : (
                <Avatar name={p.name} size="sm" />
              )}
            </div>
          </div>
        ))}
        {allParticipants.length > 7 && (
          <div className={styles.avatarMore} style={{ zIndex: 0 }}>
            +{allParticipants.length - 7}
          </div>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

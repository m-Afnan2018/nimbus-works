'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/hooks/useChatSocket';
import { useRoomStore } from '@/store/roomStore';
import { useAuthStore } from '@/store/authStore';
import Avatar from '@/components/ui/Avatar/Avatar';
import styles from './InviteModal.module.css';
import { Search, UserPlus, X } from 'lucide-react';

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function avatarSrc(avatar?: string | null) {
  if (!avatar) return undefined;
  return avatar.startsWith('http') ? avatar : `${STATIC_BASE}${avatar}`;
}

interface RoomUser {
  _id: string;
  name: string;
  avatar?: string | null;
  role: string;
}

interface InviteModalProps {
  onClose: () => void;
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const { activeRoomId, activeRoomName, participants } = useRoomStore();
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [query, setQuery] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    fetch(`${API_BASE}/rooms/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const participantIds = new Set(participants.map((p) => p._id));

  const filtered = users.filter(
    (u) =>
      !participantIds.has(u._id) &&
      u.name.toLowerCase().includes(query.toLowerCase()),
  );

  function invite(user: RoomUser) {
    if (!activeRoomId || sent.has(user._id)) return;
    getSocket()?.emit('voice:invite', {
      roomId: activeRoomId,
      roomName: activeRoomName,
      toUserId: user._id,
    });
    setSent((prev) => new Set(Array.from(prev).concat(user._id)));
  }

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <UserPlus size={15} />
            <span>
              Invite to <strong>{activeRoomName}</strong>
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search members…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.list}>
          {loading && <p className={styles.empty}>Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className={styles.empty}>
              {query ? 'No members match your search.' : 'Everyone is already in the room.'}
            </p>
          )}
          {filtered.map((user) => (
            <div key={user._id} className={styles.row}>
              <div className={styles.avatarWrap}>
                {user.avatar ? (
                  <img src={avatarSrc(user.avatar)} alt={user.name} className={styles.avatar} />
                ) : (
                  <Avatar name={user.name} size="sm" />
                )}
              </div>
              <div className={styles.info}>
                <span className={styles.name}>{user.name}</span>
                <span className={styles.role}>{user.role}</span>
              </div>
              <button
                className={`${styles.inviteBtn} ${sent.has(user._id) ? styles.inviteBtnSent : ''}`}
                onClick={() => invite(user)}
                disabled={sent.has(user._id)}
              >
                {sent.has(user._id) ? 'Invited!' : 'Invite'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

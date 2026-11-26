'use client';

import { useEffect, useRef } from 'react';
import { useInviteStore } from '@/store/inviteStore';
import { joinRoom } from '@/hooks/useRoomSocket';
import Avatar from '@/components/ui/Avatar/Avatar';
import styles from './InviteToast.module.css';
import { PhoneIncoming, X } from 'lucide-react';

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function avatarSrc(avatar?: string | null) {
  if (!avatar) return undefined;
  return avatar.startsWith('http') ? avatar : `${STATIC_BASE}${avatar}`;
}

export default function InviteToast() {
  const { invites, dismissInvite } = useInviteStore();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const invite of invites) {
      if (!timers.current.has(invite.id)) {
        const t = setTimeout(() => dismissInvite(invite.id), 30_000);
        timers.current.set(invite.id, t);
      }
    }
    Array.from(timers.current.entries()).forEach(([id, t]) => {
      if (!invites.find((i) => i.id === id)) {
        clearTimeout(t);
        timers.current.delete(id);
      }
    });
  }, [invites, dismissInvite]);

  if (invites.length === 0) return null;

  return (
    <div className={styles.container}>
      {invites.map((invite) => (
        <div key={invite.id} className={styles.toast}>
          <div className={styles.avatarWrap}>
            {invite.from.avatar ? (
              <img src={avatarSrc(invite.from.avatar)} alt={invite.from.name} className={styles.avatar} />
            ) : (
              <Avatar name={invite.from.name} size="sm" />
            )}
            <span className={styles.phoneIcon}><PhoneIncoming size={10} /></span>
          </div>
          <div className={styles.text}>
            <span className={styles.title}>Voice invite</span>
            <span className={styles.body}>
              <strong>{invite.from.name}</strong> invited you to <em>{invite.roomName}</em>
            </span>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.joinBtn}
              onClick={() => {
                joinRoom(invite.roomId, invite.roomName);
                dismissInvite(invite.id);
              }}
            >
              Join
            </button>
            <button
              className={styles.dismissBtn}
              onClick={() => dismissInvite(invite.id)}
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

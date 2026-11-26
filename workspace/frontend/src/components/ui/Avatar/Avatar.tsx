'use client';

import { cn, getInitials } from '@/lib/utils';
import { getStaticUrl } from '@/lib/media';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name);
  const resolvedSrc = getStaticUrl(src);

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        className={cn(styles.avatar, styles[size], className)}
      />
    );
  }

  return (
    <div className={cn(styles.avatar, styles.placeholder, styles[size], className)}>
    {initials}
    </div>
  );
}

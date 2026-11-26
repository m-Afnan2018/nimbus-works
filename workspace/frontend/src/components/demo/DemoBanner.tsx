'use client';

import { useEffect, useState } from 'react';
import { IS_DEMO } from '@/lib/demo';
import styles from './Demo.module.css';

const KEY = 'demo-banner-dismissed';

/** Thin dismissible strip reminding visitors they are on the public demo. */
export default function DemoBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try { setHidden(sessionStorage.getItem(KEY) === '1'); } catch { setHidden(false); }
  }, []);

  if (!IS_DEMO || hidden) return null;
  return (
    <div className={styles.banner} role="note">
      <span>
        <strong>Demo mode</strong> — all data is fictional and resets daily. Destructive actions are disabled.
      </span>
      <button
        type="button"
        aria-label="Dismiss demo notice"
        onClick={() => { setHidden(true); try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } }}
      >
        ×
      </button>
    </div>
  );
}

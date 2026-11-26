'use client';

import { useEffect, useState } from 'react';
import { IS_DEMO } from '@/lib/demo';

const KEY = 'demo-banner-dismissed';

/** Thin dismissible strip reminding visitors they are on the public demo. */
export default function DemoBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try { setHidden(sessionStorage.getItem(KEY) === '1'); } catch { setHidden(false); }
  }, []);

  if (!IS_DEMO || hidden) return null;
  return (
    <div
      role="note"
      style={{
        position: 'sticky', top: 0, zIndex: 1000, padding: '6px 40px 6px 16px', background: '#4f46e5',
        color: '#fff', fontSize: 13, textAlign: 'center',
      }}
    >
      <strong>Demo mode</strong> — all figures are fictional and reset daily. Deletes and emails are disabled.
      <button
        type="button"
        aria-label="Dismiss demo notice"
        onClick={() => { setHidden(true); try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } }}
        style={{ position: 'absolute', right: 10, top: 4, background: 'none', border: 0, color: '#fff', fontSize: 18, cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}

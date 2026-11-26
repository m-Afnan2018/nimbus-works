'use client';

import { DEMO_ACCOUNTS, DEMO_PASSWORD, IS_DEMO } from '@/lib/demo';
import styles from './Demo.module.css';

interface Props {
  onPick: (email: string, password: string) => void;
  disabled?: boolean;
}

/** Login-page panel listing the demo accounts; clicking one fills the form. */
export default function DemoCredentials({ onPick, disabled }: Props) {
  if (!IS_DEMO) return null;
  return (
    <div className={styles.creds}>
      <div className={styles.credsHead}>
        <span className={styles.badge}>Live demo</span>
        <span>Pick an account · password <code>{DEMO_PASSWORD}</code></span>
      </div>
      <div className={styles.credsGrid}>
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            className={styles.credBtn}
            disabled={disabled}
            onClick={() => onPick(a.email, DEMO_PASSWORD)}
            title={a.blurb}
          >
            <strong>{a.role}</strong>
            <span>{a.email}</span>
          </button>
        ))}
      </div>
      <p className={styles.credsNote}>Data is fake and resets every 24 hours. Deletes, emails &amp; uploads are disabled.</p>
    </div>
  );
}

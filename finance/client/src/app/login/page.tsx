'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { IS_DEMO, DEMO_LOGIN } from '@/lib/demo';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Invalid credentials');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>N</div>
          <div className={styles.logoName}>Nimbus Finance</div>
          <div className={styles.logoSub}>
            Sign in to access the dashboard
          </div>
        </div>

        {/* Form card */}
        <div className={styles.formCard}>
          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="form-field">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className={`form-field ${error ? styles.fieldPasswordError : styles.fieldPassword}`}>
              <label className="form-label">Password</label>
              <div className={styles.pwWrap}>
                <input
                  className={`form-input ${styles.pwInput}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className={styles.pwToggle}
                  tabIndex={-1}
                >
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} ${styles.pwToggleIcon}`} />
                </button>
              </div>
            </div>

            {error && (
              <div className={styles.errorBanner}>
                <i className={`ti ti-alert-circle ${styles.errorIcon}`} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-p ${styles.submitBtn}`}
              disabled={loading || !username.trim() || !password}
            >
              {loading
                ? <><i className={`ti ti-loader-2 ${styles.submitBtnIcon}`} />Signing in…</>
                : <><i className={`ti ti-login ${styles.submitBtnIcon}`} />Sign In</>}
            </button>
          </form>

          {IS_DEMO && (
            <button
              type="button"
              className={styles.demoCreds}
              onClick={() => { setUsername(DEMO_LOGIN.username); setPassword(DEMO_LOGIN.password); }}
            >
              <span className={styles.demoBadge}>Live demo</span>
              <span>Username <code>{DEMO_LOGIN.username}</code> · Password <code>{DEMO_LOGIN.password}</code></span>
              <span className={styles.demoHint}>Click to fill · data is fake and resets every 24 h</span>
            </button>
          )}
        </div>

        <div className={styles.footer}>
          Nimbus Works — CFO Dashboard demo
        </div>
      </div>
    </div>
  );
}

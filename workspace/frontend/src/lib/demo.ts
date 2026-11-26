/** Public-demo helpers. Demo UI is on unless NEXT_PUBLIC_DEMO_MODE is explicitly "false". */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ACCOUNTS = [
  { role: 'Admin',   email: 'admin@demo.com',   blurb: 'Full access: team, departments, SOPs' },
  { role: 'Manager', email: 'manager@demo.com', blurb: 'Runs projects & approves work' },
  { role: 'Member',  email: 'member@demo.com',  blurb: 'Day-to-day tasks, timer, chat' },
  { role: 'Viewer',  email: 'viewer@demo.com',  blurb: 'Read-only stakeholder' },
] as const;

let lastToast = 0;

/** Lightweight, dependency-free toast for "Disabled in demo" responses. */
export function showDemoToast(message = 'Disabled in demo — this action is turned off on the public demo.') {
  if (typeof document === 'undefined') return;
  const now = Date.now();
  if (now - lastToast < 1500) return; // de-dupe bursts of blocked requests
  lastToast = now;

  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = `🔒 ${message}`;
  Object.assign(el.style, {
    position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%) translateY(20px)',
    background: '#1f2937', color: '#fff', padding: '12px 18px', borderRadius: '10px',
    fontSize: '14px', fontWeight: '500', boxShadow: '0 10px 30px rgba(0,0,0,.3)', zIndex: '99999',
    opacity: '0', transition: 'opacity .2s ease, transform .2s ease', maxWidth: 'calc(100vw - 32px)', textAlign: 'center',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 3200);
}

/** True if an axios error is the backend's demo-mode rejection. */
export function isDemoBlocked(error: unknown): boolean {
  const res = (error as { response?: { status?: number; data?: { demo?: boolean } } })?.response;
  return res?.status === 403 && res.data?.demo === true;
}

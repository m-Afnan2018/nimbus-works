'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

/**
 * The app is a static export (no Next middleware), so the "logged in?" check
 * runs here: ask the API once, and send visitors without a session to /login.
 * The API still enforces auth on every request; this only avoids showing an
 * empty dashboard first.
 */
export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setAuthed(true);
        else window.location.replace('/login');
      })
      .catch(() => { if (!cancelled) setAuthed(true); }); // network blip: let pages show their own errors
    return () => { cancelled = true; };
  }, [isLogin]);

  if (isLogin) return <>{children}</>;
  if (!authed) return null;
  return (
    <div id="app">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}

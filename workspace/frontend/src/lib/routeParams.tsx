'use client';

/**
 * Dynamic routes under a static export.
 *
 * The app is built with `output: 'export'` and served as plain files by nginx
 * (no Node server, so it fits on a 512 MB box). A static export can only
 * prerender known params, so each dynamic route is prerendered once with the
 * placeholder "_" and nginx serves that page for every real id. The real
 * params are then read from the browser URL.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** Params for `pattern` (e.g. "/projects/:id") parsed from the current URL. */
export function useRouteParams(pattern: string): Record<string, string> {
  const parts = (usePathname() || '').split('/');
  const params: Record<string, string> = {};
  pattern.split('/').forEach((key, i) => {
    if (key.startsWith(':')) params[key.slice(1)] = decodeURIComponent(parts[i] ?? '');
  });
  return params;
}

/**
 * Renders children only in the browser, so the placeholder "_" page is never
 * rendered (or fetched) at build time.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : null;
}

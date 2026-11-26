const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

/** Resolves a relative upload path (e.g. `/uploads/usersDP/x.png`) stored by the
 *  backend into an absolute URL. Passes already-absolute URLs through unchanged. */
export function getStaticUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${STATIC_BASE}${path}`;
}

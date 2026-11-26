import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Tiny in-memory fixed-window rate limiter: no Redis and no extra dependency,
 * which suits a single-process API on a small VPS. Counters reset when the
 * process restarts.
 */
export function createLimiter(limit: number, windowMs: number): (key: string) => boolean {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

/**
 * Client IP from X-Forwarded-For, trusting the last `hops` proxies (the same
 * rule Express applies with `trust proxy` set to a number). Used by Socket.IO,
 * which doesn't go through Express's req.ip.
 */
export function clientIp(xff: string | string[] | undefined, remote: string | undefined, hops: number): string {
  const chain = (Array.isArray(xff) ? xff.join(',') : xff || '')
    .split(',').map((s) => s.trim()).filter(Boolean).reverse();
  if (hops > 0 && chain.length) return chain[Math.min(hops, chain.length) - 1];
  return remote || 'unknown';
}

export const trustProxyHops = (): number => Number(process.env.TRUST_PROXY_HOPS || 0);

const MESSAGE = 'Too many requests — please slow down and try again in a minute.';

export function rateLimit(opts: { limit: number; windowMs: number; methods?: string[] }): RequestHandler {
  const allow = createLimiter(opts.limit, opts.windowMs);
  return (req: Request, res: Response, next: NextFunction) => {
    if (opts.methods && !opts.methods.includes(req.method)) return next();
    if (allow(req.ip || 'unknown')) return next();
    res.setHeader('Retry-After', String(Math.ceil(opts.windowMs / 1000)));
    res.status(429).json({ message: MESSAGE, error: MESSAGE });
  };
}

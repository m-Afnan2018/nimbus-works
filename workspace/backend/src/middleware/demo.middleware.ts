import { Request, Response, NextFunction } from 'express';

/**
 * DEMO_MODE guard.
 *
 * When DEMO_MODE=true the public demo stays usable (create / edit records,
 * move tasks, chat, check in…) but anything destructive, account-altering,
 * bulk, or outward-facing (push, social publishing, uploads) is rejected with
 * a friendly 403 that the frontend turns into a "Disabled in demo" toast.
 */
export const isDemoMode = (): boolean => process.env.DEMO_MODE === 'true';

export const DEMO_MESSAGE = 'Disabled in demo — this action is turned off on the public demo.';

type Rule = { method: string | '*'; pattern: RegExp };

const BLOCKED: Rule[] = [
  // Account & identity — shared demo logins must stay usable for everyone
  { method: '*',    pattern: /^\/api\/auth\/(register|me)(\/|$)/ },
  { method: 'POST', pattern: /^\/api\/auth\/logout-all$/ },
  { method: '*',    pattern: /^\/api\/admin\/users/ },
  { method: 'PUT',  pattern: /^\/api\/team\/[^/]+\/role$/ },

  // File uploads (no public file hosting)
  { method: 'POST', pattern: /^\/api\/upload$/ },
  { method: '*',    pattern: /^\/api\/projects\/[^/]+\/media/ },

  // Outbound: push notifications & social publishing
  { method: '*',    pattern: /^\/api\/push\// },
  { method: '*',    pattern: /^\/api\/projects\/[^/]+\/social\/accounts/ },
  { method: 'POST', pattern: /^\/api\/projects\/[^/]+\/social\/posts\/[^/]+\/publish-now$/ },

  // Bulk updates
  { method: 'POST', pattern: /^\/api\/attendance\/mark-absent$/ },
  { method: 'PUT',  pattern: /^\/api\/notifications\/read-all$/ },
];

export function demoGuard(req: Request, res: Response, next: NextFunction): void {
  if (!isDemoMode()) return next();

  const path = req.originalUrl.split('?')[0];
  const blocked =
    req.method === 'DELETE' ||
    BLOCKED.some((r) => (r.method === '*' || r.method === req.method) && r.pattern.test(path));

  if (blocked && req.method !== 'GET') {
    res.status(403).json({ message: DEMO_MESSAGE, error: DEMO_MESSAGE, demo: true });
    return;
  }
  next();
}

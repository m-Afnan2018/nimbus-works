import { Request, Response, NextFunction } from 'express';

/**
 * DEMO_MODE guard for the finance API.
 * Deletes, bulk operations, SMTP settings and every email/reminder send are
 * rejected with a friendly 403 the client shows as a "Disabled in demo" toast.
 */
export const isDemoMode = (): boolean => process.env.DEMO_MODE === 'true';

export const DEMO_MESSAGE = 'Disabled in demo — this action is turned off on the public demo.';

type Rule = { method: string | '*'; pattern: RegExp };

const BLOCKED: Rule[] = [
  // Email / reminders / SMTP
  { method: '*',    pattern: /\/send-reminder$/ },
  { method: '*',    pattern: /\/test$/ },
  { method: '*',    pattern: /\/smtp$/ },
  // Bulk updates
  { method: 'PUT',  pattern: /^\/api\/salary-records\/period\/[^/]+\/process$/ },
  { method: 'POST', pattern: /^\/api\/expenses\/apply-recurring$/ },
];

export function demoGuard(req: Request, res: Response, next: NextFunction): void {
  if (!isDemoMode()) return next();

  const path = req.originalUrl.split('?')[0];
  const blocked =
    req.method === 'DELETE' ||
    BLOCKED.some((r) => (r.method === '*' || r.method === req.method) && r.pattern.test(path));

  if (blocked && req.method !== 'GET') {
    res.status(403).json({ error: DEMO_MESSAGE, message: DEMO_MESSAGE, demo: true });
    return;
  }
  next();
}

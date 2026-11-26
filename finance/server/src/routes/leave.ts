import { Router, Request, Response } from 'express';
import WorkspaceAttendance from '../models/shared/WorkspaceAttendance';

const router = Router();

// GET /api/leave
// Query: userId, period (YYYY-MM), status (comma-separated), mode
// Defaults to leave-type statuses: absent, leave, half_day
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, period, status, mode } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    if (userId) filter.user = userId;

    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end   = new Date(Number(y), Number(m), 1);
      filter.date = { $gte: start, $lt: end };
    }

    if (status) {
      filter.status = { $in: status.split(',').map((s) => s.trim()) };
    } else {
      filter.status = { $in: ['absent', 'leave', 'half_day'] };
    }

    if (mode) filter.workMode = mode;

    const records = await WorkspaceAttendance.find(filter)
      .populate('user', 'name email avatar role')
      .sort({ date: -1 })
      .limit(500);

    res.json(records);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leave/summary?period=YYYY-MM
// Monthly attendance summary per user
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period } = req.query as { period?: string };

    const matchStage: Record<string, unknown> = {};
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end   = new Date(Number(y), Number(m), 1);
      matchStage.date = { $gte: start, $lt: end };
    }

    const summary = await WorkspaceAttendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          totalDays:   { $sum: 1 },
          presentDays: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          leaveDays:   { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          absentDays:  { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          halfDays:    { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          lateDays:    { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          remoteDays:  { $sum: { $cond: [{ $eq: ['$status', 'remote'] }, 1, 0] } },
          avgHours:    { $avg: '$hoursWorked' },
          totalHours:  { $sum: '$hoursWorked' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          email: '$user.email',
          avatar: '$user.avatar',
          role: '$user.role',
          totalDays: 1, presentDays: 1, leaveDays: 1, absentDays: 1,
          halfDays: 1, lateDays: 1, remoteDays: 1,
          avgHours:  { $round: ['$avgHours', 2] },
          totalHours: { $round: ['$totalHours', 2] },
        },
      },
      { $sort: { name: 1 } },
    ]);

    res.json(summary);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leave/user/:userId?period=YYYY-MM — full attendance log for one employee
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { period } = req.query as { period?: string };
    const filter: Record<string, unknown> = { user: req.params.userId };

    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end   = new Date(Number(y), Number(m), 1);
      filter.date = { $gte: start, $lt: end };
    }

    const records = await WorkspaceAttendance.find(filter)
      .populate('user', 'name email avatar role')
      .sort({ date: -1 });

    res.json(records);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import Expense from '../models/Expense';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.category) filter.category = req.query.category as string;
    if (req.query.month) filter.date = { $regex: `^${req.query.month}` };
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Copy all recurring expenses from previous month into the given month
router.post('/apply-recurring', async (req: Request, res: Response) => {
  try {
    const { month } = req.body as { month: string }; // YYYY-MM
    if (!month) return res.status(400).json({ error: 'month required' });

    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const recurring   = await Expense.find({ recurring: true, date: { $regex: `^${prevMonth}` } });
    const existing    = await Expense.find({ date: { $regex: `^${month}` } });

    const created: unknown[] = [];
    for (const r of recurring) {
      const alreadyExists = existing.some(
        e => e.vendor === r.vendor && e.category === r.category && e.amount === r.amount
      );
      if (!alreadyExists) {
        const day = r.date?.slice(8, 10) || '01';
        const newExpense = await Expense.create({
          date: `${month}-${day}`,
          category: r.category,
          vendor: r.vendor,
          description: r.description,
          amount: r.amount,
          type: r.type,
          payMethod: r.payMethod,
          recurring: true,
        });
        created.push(newExpense);
      }
    }
    res.json({ created: created.length, expenses: created });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ error: 'Not found' });
    res.json(expense);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

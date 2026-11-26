import { Router, Request, Response } from 'express';
import Organization from '../models/Organization';
import OrgTransaction, { IOrgTransaction } from '../models/OrgTransaction';

const router = Router();

function summarize(txs: Pick<IOrgTransaction, 'type' | 'amount' | 'gstAmount'>[]) {
  const revenue = txs.filter(t => t.type === 'Revenue').reduce((s, t) => s + (t.amount || 0), 0);
  const expense = txs.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0);
  const gstCollected = txs.filter(t => t.type === 'Revenue').reduce((s, t) => s + (t.gstAmount || 0), 0);
  const gstPaid = txs.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.gstAmount || 0), 0);
  return {
    revenue,
    expense,
    netProfit: revenue - expense,
    gstCollected,
    gstPaid,
    netGST: gstCollected - gstPaid,
  };
}

function computeGstAmount(amount: unknown, gstRate: unknown): number {
  return Math.round(((Number(amount) || 0) * (Number(gstRate) || 0)) / 100);
}

// ── Organizations ──────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [orgs, txs] = await Promise.all([
      Organization.find().sort({ createdAt: 1 }),
      OrgTransaction.find(),
    ]);
    const byOrg = new Map<string, IOrgTransaction[]>();
    for (const t of txs) {
      const key = t.organization.toString();
      if (!byOrg.has(key)) byOrg.set(key, []);
      byOrg.get(key)!.push(t);
    }
    const result = orgs.map(o => {
      const orgTxs = byOrg.get(o._id.toString()) || [];
      return { ...o.toObject(), ...summarize(orgTxs), transactionCount: orgTxs.length };
    });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Not found' });
    const transactions = await OrgTransaction.find({ organization: org._id }).sort({ date: -1, createdAt: -1 });
    res.json({ ...org.toObject(), transactions, ...summarize(transactions) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const org = await Organization.create(req.body);
    res.status(201).json(org);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const org = await Organization.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Organization.findByIdAndDelete(req.params.id);
    await OrgTransaction.deleteMany({ organization: req.params.id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Billing ledger entries ───────────────────────────────────────────
router.post('/:id/transactions', async (req: Request, res: Response) => {
  try {
    const gstAmount = computeGstAmount(req.body.amount, req.body.gstRate);
    const tx = await OrgTransaction.create({ ...req.body, organization: req.params.id, gstAmount });
    res.status(201).json(tx);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.put('/transactions/:txId', async (req: Request, res: Response) => {
  try {
    const patch: Record<string, unknown> = { ...req.body };
    if (patch.amount !== undefined || patch.gstRate !== undefined) {
      const existing = await OrgTransaction.findById(req.params.txId);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const amount = patch.amount !== undefined ? patch.amount : existing.amount;
      const gstRate = patch.gstRate !== undefined ? patch.gstRate : existing.gstRate;
      patch.gstAmount = computeGstAmount(amount, gstRate);
    }
    const tx = await OrgTransaction.findByIdAndUpdate(req.params.txId, { $set: patch }, { new: true, runValidators: true });
    if (!tx) return res.status(404).json({ error: 'Not found' });
    res.json(tx);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.delete('/transactions/:txId', async (req: Request, res: Response) => {
  try {
    await OrgTransaction.findByIdAndDelete(req.params.txId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

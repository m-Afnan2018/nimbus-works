import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ClientRecord from '../models/ClientRecord';
import Invoice from '../models/Invoice';
import Service from '../models/Service';
import WorkspaceProject from '../models/shared/WorkspaceProject';
import WorkspaceDepartment from '../models/shared/WorkspaceDepartment';
import WorkspaceTask from '../models/shared/WorkspaceTask';
import WorkspaceUser from '../models/shared/WorkspaceUser';
import ClientMeta from '../models/ClientMeta';

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dueDate(from: Date) { const d = new Date(from); d.setDate(d.getDate() + 15); return d; }

async function makeInvoiceForRecord(record: { name: string; service: string; monthlyBilling: number; billingPeriod: string }, status: 'Paid' | 'Pending' | 'Partial') {
  const count = await Invoice.countDocuments();
  const today = new Date();
  const amount = record.monthlyBilling;
  const gst = Math.round(amount * 0.18);
  return Invoice.create({
    invoiceNumber: `INV-${String(count + 1).padStart(3, '0')}`,
    client: record.name,
    date: fmtDate(today),
    dueDate: fmtDate(dueDate(today)),
    lineItems: [{ description: record.service || '—', qty: 1, unitPrice: amount, amount }],
    amount,
    gst,
    gstRate: 18,
    total: amount + gst,
    notes: `Monthly billing — ${record.billingPeriod}`,
    status,
  });
}

const router = Router();

// GET /periods — all distinct billing periods with summary totals (newest first)
router.get('/periods', async (_req: Request, res: Response) => {
  try {
    const periods = await ClientRecord.aggregate([
      {
        $group: {
          _id: '$billingPeriod',
          total:    { $sum: '$monthlyBilling' },
          paid:     { $sum: { $cond: [{ $eq: ['$status', 'Paid'] },    '$monthlyBilling', 0] } },
          pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$monthlyBilling', 0] } },
          count:    { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
        },
      },
      { $sort: { _id: -1 } },
    ]);
    res.json(periods);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /?period=2026-06 — records for a specific billing period
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const filter = period ? { billingPeriod: period } : {};
    const records = await ClientRecord.find(filter).sort({ name: 1 });
    res.json(records);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

interface SvcItem { name: string; qty: number; isOneTime?: boolean; }

interface ClientOverride {
  clientId: string;
  name: string;
  service: string;
  monthlyBilling: number;
  manager: string;
  initials: string;
  colorKey: string;
  services?: SvcItem[];
}

// After billing records are created, auto-create Workspace tasks per service item per client
async function createBillingTasks(
  entries: Array<{ clientId: string; name: string; services?: SvcItem[] }>,
  period: string
) {
  try {
    const reporter = await WorkspaceUser.findOne({ role: 'admin', isActive: true });
    if (!reporter) return;

    const allServices = await Service.find({});
    const serviceByName = new Map(allServices.map(s => [s.name.toLowerCase().trim(), s]));

    for (const entry of entries) {
      if (!entry.services?.length || !entry.clientId) continue;
      const projectId = new mongoose.Types.ObjectId(entry.clientId);
      const billingTag = `billing:${period}`;

      for (const svc of entry.services) {
        const svcDoc = serviceByName.get(svc.name.toLowerCase().trim());
        if (!svcDoc) continue;

        // Resolve which Workspace department this service belongs to
        let deptId: mongoose.Types.ObjectId | null = null;
        if (!svcDoc.parentId) {
          // Top-level service — workspaceId IS the department
          deptId = svcDoc.workspaceId as mongoose.Types.ObjectId;
        } else {
          // Sub-service — find parent department that contains this taskTemplate
          const parent = await WorkspaceDepartment.findOne({ 'taskTemplates._id': svcDoc.workspaceId });
          if (parent) deptId = parent._id as mongoose.Types.ObjectId;
        }
        if (!deptId) continue;

        // Build date string DD/MM/YYYY for task name
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        // If sub-service has Types defined, create one task per Type; otherwise one task per billing unit
        let taskTypes: Array<{ title: string; priority: string }> = [];
        if (svcDoc.parentId) {
          const deptDoc = await WorkspaceDepartment.findById(deptId);
          if (deptDoc) {
            const tmpl = deptDoc.taskTemplates.find(t => t._id.toString() === svcDoc.workspaceId.toString());
            if (tmpl && (tmpl as any).types?.length > 0) {
              taskTypes = (tmpl as any).types.map((ty: any) => ({ title: ty.title, priority: ty.priority || 'medium' }));
            }
          }
        }

        if (taskTypes.length > 0) {
          // Create one task per Type — name format: TypeTitle_DD/MM/YYYY_Serial
          for (let i = 0; i < taskTypes.length; i++) {
            const { title: typeTitle, priority: typePriority } = taskTypes[i];
            const safeType = typeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const existingCount = await WorkspaceTask.countDocuments({ project: projectId, tags: billingTag, title: new RegExp(`^${safeType}_`) });
            if (existingCount > 0) continue; // idempotent
            const serial = String(i + 1).padStart(2, '0');
            await WorkspaceTask.create({
              title: `${typeTitle}_${dateStr}_${serial}`,
              project: projectId,
              department: deptId,
              reporter: reporter._id,
              status: 'backlog',
              priority: typePriority,
              assignees: [],
              isPersonal: false,
              tags: [billingTag],
              order: i,
              totalElapsedSeconds: 0,
            });
          }
        } else {
          // No Types defined — fallback: one task per billing unit
          const qty = Math.max(1, svc.qty || 1);
          const safeName = svc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const existingCount = await WorkspaceTask.countDocuments({ project: projectId, tags: billingTag, title: new RegExp(`^${safeName}_`) });
          for (let i = 0; i < qty; i++) {
            if (i < existingCount) continue;
            const serial = String(i + 1).padStart(2, '0');
            await WorkspaceTask.create({
              title: `${svc.name}_${dateStr}_${serial}`,
              project: projectId,
              department: deptId,
              reporter: reporter._id,
              status: 'backlog',
              priority: 'medium',
              assignees: [],
              isPersonal: false,
              tags: [billingTag],
              order: i,
              totalElapsedSeconds: 0,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('createBillingTasks error:', err);
  }
}

// POST /run — snapshot clients into a new billing period.
// Body: { period, clients? }  — if clients[] is provided those entries are used directly;
// otherwise all active clients are fetched from the DB.
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { period, clients: overrides, force } = req.body as { period: string; clients?: ClientOverride[]; force?: boolean };
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'period must be YYYY-MM' });
    }
    const existing = await ClientRecord.countDocuments({ billingPeriod: period });
    if (existing > 0) {
      if (!force) return res.status(409).json({ error: `Billing for ${period} already exists` });
      await ClientRecord.deleteMany({ billingPeriod: period });
    }

    let records: object[];
    let taskEntries: Array<{ clientId: string; name: string; services?: SvcItem[] }> = [];

    if (overrides && overrides.length > 0) {
      records = overrides.map(c => ({
        clientId: c.clientId,
        name: c.name,
        service: c.service || '—',
        monthlyBilling: Number(c.monthlyBilling) || 0,
        manager: c.manager || '',
        status: 'Pending' as const,
        billingPeriod: period,
        initials: c.initials,
        colorKey: c.colorKey || 'emerald',
      }));
      taskEntries = overrides.map(c => ({ clientId: c.clientId, name: c.name, services: c.services }));
    } else {
      // Pull active/planning projects from Workspace and merge CFO billing metadata
      const [projects, metas] = await Promise.all([
        WorkspaceProject.find({ status: { $in: ['active', 'planning'] } }).populate('owner', 'name'),
        ClientMeta.find(),
      ]);
      if (!projects.length) {
        return res.status(400).json({ error: 'No active projects (clients) found in Workspace' });
      }
      const metaMap = new Map(metas.map((m) => [m.projectId.toString(), m]));
      const colors = ['emerald', 'indigo', 'blue', 'amber', 'red'];
      records = projects.map((p, i) => {
        const meta = metaMap.get(p._id.toString());
        const ownerName = (p.owner as any)?.name ?? '';
        const initials = meta?.initials
          || p.title.split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
        return {
          clientId: p._id,
          name: p.title,
          service: p.tags[0] || '—',
          monthlyBilling: meta?.monthlyBilling ?? 0,
          manager: ownerName,
          status: 'Pending' as const,
          billingPeriod: period,
          initials,
          colorKey: meta?.colorKey ?? colors[i % colors.length],
        };
      });
    }

    const created = await ClientRecord.insertMany(records);

    // Fire-and-forget: create Workspace tasks for each service item
    createBillingTasks(taskEntries, period).catch(console.error);

    res.status(201).json(created);
  } catch (err) {
    console.error('clientRecords POST /run:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /add-client — append a single client to an already-existing billing period
router.post('/add-client', async (req: Request, res: Response) => {
  try {
    const { period, clientId, name, service, monthlyBilling, manager, initials, colorKey } = req.body as {
      period: string; clientId: string; name: string; service?: string;
      monthlyBilling?: number; manager?: string; initials?: string; colorKey?: string;
    };
    if (!period || !clientId) return res.status(400).json({ error: 'period and clientId are required' });
    const alreadyIn = await ClientRecord.findOne({ billingPeriod: period, clientId });
    if (alreadyIn) return res.status(409).json({ error: 'Client already in this billing period' });
    const record = await ClientRecord.create({
      clientId, name, service: service || '—',
      monthlyBilling: Number(monthlyBilling) || 0,
      manager: manager || '', status: 'Pending', billingPeriod: period,
      initials: initials || '', colorKey: colorKey || 'emerald',
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('POST /add-client:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /yearly — monthly + yearly aggregated billing summary (includes payment received totals)
router.get('/yearly', async (_req: Request, res: Response) => {
  try {
    const records = await ClientRecord.find({}).lean();

    type MonthBucket = {
      billed: number; received: number;
      paid: number; partial: number; pending: number;
      count: number; paidCount: number; partialCount: number; pendingCount: number;
    };
    const yearMap: Record<string, Record<string, MonthBucket>> = {};

    for (const r of records) {
      const [year] = (r.billingPeriod as string).split('-');
      const received = ((r.payments as { amount?: number }[] | undefined) ?? [])
        .reduce((s, p) => s + (p.amount || 0), 0);

      if (!yearMap[year]) yearMap[year] = {};
      if (!yearMap[year][r.billingPeriod as string]) {
        yearMap[year][r.billingPeriod as string] = {
          billed: 0, received: 0, paid: 0, partial: 0, pending: 0,
          count: 0, paidCount: 0, partialCount: 0, pendingCount: 0,
        };
      }
      const m = yearMap[year][r.billingPeriod as string];
      m.billed   += (r.monthlyBilling as number) || 0;
      m.received += received;
      m.count    += 1;
      if (r.status === 'Paid')         { m.paid     += (r.monthlyBilling as number) || 0; m.paidCount    += 1; }
      else if (r.status === 'Partial') { m.partial  += received;                          m.partialCount += 1; }
      else                             { m.pending  += (r.monthlyBilling as number) || 0; m.pendingCount += 1; }
    }

    const result = Object.keys(yearMap)
      .sort((a, b) => b.localeCompare(a))
      .map(year => {
        const months = Object.keys(yearMap[year]).sort().map(period => ({ period, ...yearMap[year][period] }));
        const totals = months.reduce(
          (acc, m) => ({
            billed: acc.billed + m.billed, received: acc.received + m.received,
            paid: acc.paid + m.paid, partial: acc.partial + m.partial, pending: acc.pending + m.pending,
            count: acc.count + m.count, paidCount: acc.paidCount + m.paidCount,
            partialCount: acc.partialCount + m.partialCount, pendingCount: acc.pendingCount + m.pendingCount,
          }),
          { billed: 0, received: 0, paid: 0, partial: 0, pending: 0, count: 0, paidCount: 0, partialCount: 0, pendingCount: 0 }
        );
        return { year, months, ...totals };
      });

    res.json(result);
  } catch (err) {
    console.error('GET /yearly:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /period/:period/process — mark all Pending records in a period as Paid (auto-creates invoices)
router.put('/period/:period/process', async (req: Request, res: Response) => {
  try {
    const period = req.params.period;
    const pending = await ClientRecord.find({ billingPeriod: period, status: 'Pending' });
    for (const record of pending) {
      if (record.invoiceId) {
        await Invoice.findByIdAndUpdate(record.invoiceId, { status: 'Paid' });
        await ClientRecord.findByIdAndUpdate(record._id, { status: 'Paid' });
      } else {
        const inv = await makeInvoiceForRecord(record, 'Paid');
        await ClientRecord.findByIdAndUpdate(record._id, { status: 'Paid', invoiceId: inv._id });
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /:id — update a single record; auto-creates/updates invoice on status changes
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await ClientRecord.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const record = await ClientRecord.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!record) return res.status(404).json({ error: 'Not found' });

    const newStatus = req.body.status as string | undefined;
    const isPaidOrPartial = newStatus === 'Paid' || newStatus === 'Partial';
    const wasNotPaidOrPartial = existing.status !== 'Paid' && existing.status !== 'Partial';

    if (isPaidOrPartial && wasNotPaidOrPartial) {
      const invStatus = newStatus as 'Paid' | 'Partial';
      if (existing.invoiceId) {
        await Invoice.findByIdAndUpdate(existing.invoiceId, { status: invStatus });
      } else {
        const inv = await makeInvoiceForRecord(record, invStatus);
        await ClientRecord.findByIdAndUpdate(req.params.id, { invoiceId: inv._id });
      }
    }

    if (newStatus === 'Pending' && (existing.status === 'Paid' || existing.status === 'Partial')) {
      if (existing.invoiceId) {
        await Invoice.findByIdAndUpdate(existing.invoiceId, { status: 'Pending' });
      }
      await ClientRecord.findByIdAndUpdate(req.params.id, { $set: { payments: [] } });
    }

    res.json(record);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// DELETE /period/:period — remove all records for a billing period
router.delete('/period/:period', async (req: Request, res: Response) => {
  try {
    await ClientRecord.deleteMany({ billingPeriod: req.params.period });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

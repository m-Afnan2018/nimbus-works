import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import WorkspaceProject, { WorkspaceProjectStatus } from '../models/shared/WorkspaceProject';
import WorkspaceTask from '../models/shared/WorkspaceTask';
import WorkspaceUser from '../models/shared/WorkspaceUser';
import ClientMeta from '../models/ClientMeta';
import ClientRecord from '../models/ClientRecord';
import Service from '../models/Service';
import { generateTasksFromSOP } from '../services/sopTaskGenerator';

const router = Router();

const COLOR_CYCLE = ['emerald', 'indigo', 'blue', 'amber', 'red'] as const;

function autoInitials(title: string): string {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function mapStatus(status: WorkspaceProjectStatus, endDate?: Date): string {
  if (endDate) {
    const daysLeft = (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft >= 0 && daysLeft <= 30 && (status === 'active' || status === 'planning')) {
      return 'Renewal Due';
    }
  }
  switch (status) {
    case 'planning': return 'Active';
    case 'active':   return 'Active';
    case 'on_hold':  return 'Paused';
    case 'completed':
    case 'archived': return 'Inactive';
    default:         return 'Active';
  }
}

function fmtRenewal(date?: Date): string {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// Merge projects with CFO-specific metadata — used internally by clientRecords.ts
export async function buildClientList() {
  const [projects, metas] = await Promise.all([
    WorkspaceProject.find().populate('owner', 'name email').sort({ createdAt: -1 }),
    ClientMeta.find(),
  ]);

  const metaMap = new Map(metas.map((m) => [m.projectId.toString(), m]));

  return projects.map((p, i) => {
    const meta = metaMap.get(p._id.toString());
    const ownerName = (p.owner as any)?.name ?? '';
    const initials = meta?.initials || autoInitials(p.title);
    const colorKey = meta?.colorKey ?? COLOR_CYCLE[i % COLOR_CYCLE.length];

    return {
      _id: p._id,
      name: p.title,
      email: meta?.email ?? '',
      service: p.tags[0] ?? '—',
      monthlyBilling: meta?.monthlyBilling ?? 0,
      serviceBreakdown: meta?.serviceBreakdown ?? [],
      manager: ownerName,
      renewal: fmtRenewal(p.endDate),
      status: mapStatus(p.status as WorkspaceProjectStatus, p.endDate),
      initials,
      colorKey,
      workspaceStatus: p.status,
      workspaceProgress: p.progress ?? 0,
      tags: p.tags,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
}

// GET /api/clients
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await buildClientList());
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/clients/:id — includes tasks (sub-services) for this project
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await WorkspaceProject.findById(req.params.id).populate('owner', 'name email');
    if (!project) return res.status(404).json({ error: 'Not found' });

    const [meta, tasks] = await Promise.all([
      ClientMeta.findOne({ projectId: project._id }),
      WorkspaceTask.find({ project: project._id })
        .populate('assignees', 'name avatar')
        .populate('department', 'name color')
        .sort({ createdAt: -1 }),
    ]);

    const ownerName = (project.owner as any)?.name ?? '';
    const initials = meta?.initials || autoInitials(project.title);
    const colorKey = meta?.colorKey ?? 'emerald';

    res.json({
      _id: project._id,
      name: project.title,
      email: meta?.email ?? '',
      service: project.tags[0] ?? '—',
      monthlyBilling: meta?.monthlyBilling ?? 0,
      serviceBreakdown: meta?.serviceBreakdown ?? [],
      manager: ownerName,
      renewal: fmtRenewal(project.endDate),
      status: mapStatus(project.status as WorkspaceProjectStatus, project.endDate),
      initials,
      colorKey,
      workspaceStatus: project.status,
      workspaceProgress: project.progress ?? 0,
      tags: project.tags,
      tasks,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/clients — create a new project in Workspace's collection + CFO billing meta
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, service, monthlyBilling, serviceBreakdown, manager, renewal, status, colorKey, initials } = req.body as {
      name?: string; email?: string; service?: string; monthlyBilling?: number;
      serviceBreakdown?: { name: string; amount: number; type: string; billedPeriod?: string }[];
      manager?: string; renewal?: string; status?: string;
      colorKey?: string; initials?: string;
    };

    if (!name?.trim()) return res.status(400).json({ error: 'Client name is required' });

    // "Jun 2026" → Date
    const endDate = renewal ? new Date(renewal) : undefined;

    // CFO status → Workspace status
    const workspaceStatus: WorkspaceProjectStatus =
      status === 'Paused' ? 'on_hold' : status === 'Inactive' ? 'archived' : 'active';

    // Resolve manager name → Workspace user _id; fall back to any admin so the project is visible
    let ownerId: mongoose.Types.ObjectId | undefined;
    if (manager?.trim()) {
      const user = await WorkspaceUser.findOne({ name: new RegExp(`^${manager.trim()}$`, 'i') });
      if (user) ownerId = user._id as mongoose.Types.ObjectId;
    }
    if (!ownerId) {
      const admin = await WorkspaceUser.findOne({ role: 'admin', isActive: true });
      if (admin) ownerId = admin._id as mongoose.Types.ObjectId;
    }

    const tags = service && service !== '—'
      ? service.split(' + ').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const project = await WorkspaceProject.create({
      title: name.trim(),
      status: workspaceStatus,
      priority: 'medium',
      startDate: new Date(),
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      owner: ownerId,
      members: [],
      tags,
      progress: 0,
    });

    const meta = await ClientMeta.create({
      projectId: project._id,
      email: email || '',
      monthlyBilling: monthlyBilling || 0,
      serviceBreakdown: serviceBreakdown || [],
      initials: initials || autoInitials(name.trim()),
      colorKey: colorKey || 'emerald',
    });

    // Auto-generate SOP-driven tasks for any selected service that has a published SOP linked
    if (tags.length > 0 && ownerId) {
      try {
        const linkedServices = await Service.find({ name: { $in: tags }, sopId: { $ne: null } });
        for (const svc of linkedServices) {
          if (svc.sopId) await generateTasksFromSOP(svc.sopId, project._id, ownerId);
        }
      } catch (e) {
        console.error('SOP task generation failed for new client:', e);
      }
    }

    res.status(201).json({
      _id: project._id,
      name: project.title,
      email: meta.email,
      service: tags[0] ?? '—',
      monthlyBilling: meta.monthlyBilling,
      serviceBreakdown: meta.serviceBreakdown,
      manager: manager || '',
      renewal: fmtRenewal(project.endDate),
      status: mapStatus(project.status as WorkspaceProjectStatus, project.endDate),
      initials: meta.initials,
      colorKey: meta.colorKey,
      workspaceStatus: project.status,
      workspaceProgress: 0,
      tags: project.tags,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/clients/:id — update project title/status/endDate in Workspace + CFO billing metadata
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const project = await WorkspaceProject.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found in Workspace' });

    const { name, email, service, monthlyBilling, serviceBreakdown, manager, renewal, status, colorKey, initials } = req.body as {
      name?: string; email?: string; service?: string; monthlyBilling?: number;
      serviceBreakdown?: { name: string; amount: number; type: string; billedPeriod?: string }[];
      manager?: string; renewal?: string; status?: string;
      colorKey?: string; initials?: string;
    };

    // Update project-level fields
    if (name?.trim())  project.title  = name.trim();
    if (status)        project.status = (status === 'Paused' ? 'on_hold' : status === 'Inactive' ? 'archived' : 'active') as WorkspaceProjectStatus;
    if (renewal !== undefined) {
      const d = renewal ? new Date(renewal) : undefined;
      project.endDate = d && !isNaN(d.getTime()) ? d : undefined;
    }
    if (service) {
      project.tags = service === '—' ? [] : service.split(' + ').map((s: string) => s.trim()).filter(Boolean);
    }
    if (manager?.trim()) {
      const user = await WorkspaceUser.findOne({ name: new RegExp(`^${manager.trim()}$`, 'i') });
      if (user) project.owner = user._id as any;
    }
    // If project still has no owner, assign the admin so it's visible in Workspace
    if (!project.owner) {
      const admin = await WorkspaceUser.findOne({ role: 'admin', isActive: true });
      if (admin) project.owner = admin._id as any;
    }
    await project.save();

    // Auto-generate SOP-driven tasks for any linked service that doesn't have them yet
    // (generateTasksFromSOP is idempotent per project+SOP, so this is safe to re-run on every save)
    if (project.tags.length > 0 && project.owner) {
      try {
        const linkedServices = await Service.find({ name: { $in: project.tags }, sopId: { $ne: null } });
        for (const svc of linkedServices) {
          if (svc.sopId) await generateTasksFromSOP(svc.sopId, project._id, project.owner as mongoose.Types.ObjectId);
        }
      } catch (e) {
        console.error('SOP task generation failed for updated client:', e);
      }
    }

    // Update CFO metadata
    const meta = await ClientMeta.findOneAndUpdate(
      { projectId: req.params.id },
      { $set: { email, monthlyBilling, serviceBreakdown, initials, colorKey } },
      { new: true, upsert: true, runValidators: true },
    );

    const ownerName = manager || (project.owner as any)?.name || '';
    res.json({
      _id: project._id,
      name: project.title,
      email: meta?.email ?? '',
      service: project.tags[0] ?? '—',
      monthlyBilling: meta?.monthlyBilling ?? 0,
      serviceBreakdown: meta?.serviceBreakdown ?? [],
      manager: ownerName,
      renewal: fmtRenewal(project.endDate),
      status: mapStatus(project.status as WorkspaceProjectStatus, project.endDate),
      initials: meta?.initials || autoInitials(project.title),
      colorKey: meta?.colorKey ?? 'emerald',
      workspaceStatus: project.status,
      workspaceProgress: project.progress ?? 0,
      tags: project.tags,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(400).json({ error: 'Invalid data' });
  }
});

// PATCH /api/clients/:id/mark-billed — set billedPeriod on specified one-time services
router.patch('/:id/mark-billed', async (req: Request, res: Response) => {
  try {
    const { serviceNames, period } = req.body as { serviceNames: string[]; period: string };
    if (!serviceNames?.length || !period) return res.status(400).json({ error: 'serviceNames and period required' });

    const meta = await ClientMeta.findOne({ projectId: req.params.id });
    if (!meta) return res.status(404).json({ error: 'Client meta not found' });

    meta.serviceBreakdown = meta.serviceBreakdown.map(s =>
      serviceNames.includes(s.name) && s.type === 'One Time' ? { ...s, billedPeriod: period } : s
    ) as typeof meta.serviceBreakdown;
    await meta.save();

    res.json({ ok: true, serviceBreakdown: meta.serviceBreakdown });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/clients/:id — permanently deletes the client (and its tasks, incl.
// any auto-generated by SOPs) if it has no billing history; otherwise falls back
// to archiving it (soft delete), since billing records are financial history.
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const project = await WorkspaceProject.findById(id);
    if (!project) return res.status(404).json({ error: 'Not found' });

    const recordCount = await ClientRecord.countDocuments({ clientId: id });

    if (recordCount === 0) {
      await Promise.all([
        WorkspaceProject.findByIdAndDelete(id),
        ClientMeta.deleteOne({ projectId: id }),
        WorkspaceTask.deleteMany({ project: id }),
      ]);
      return res.json({ ok: true, mode: 'deleted' });
    }

    await WorkspaceProject.findByIdAndUpdate(id, { status: 'archived' });
    res.json({ ok: true, mode: 'archived' });
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

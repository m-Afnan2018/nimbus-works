import { Router, Request, Response } from 'express';
import WorkspaceSOP from '../models/shared/WorkspaceSOP';
import WorkspaceUser from '../models/shared/WorkspaceUser';
import { generateTasksFromSOP } from '../services/sopTaskGenerator';

const router = Router();

const DEPT_SELECT = 'name color';

// GET /api/sops
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sops = await WorkspaceSOP.find()
      .populate('steps.department', DEPT_SELECT)
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(sops);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sops/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sop = await WorkspaceSOP.findById(req.params.id)
      .populate('steps.department', DEPT_SELECT)
      .populate('createdBy', 'name email');
    if (!sop) return res.status(404).json({ error: 'Not found' });
    res.json(sop);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sops
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, steps, status } = req.body as {
      title?: string; description?: string; steps?: unknown[]; status?: string;
    };
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const admin = await WorkspaceUser.findOne({ role: 'admin', isActive: true });

    const sop = await WorkspaceSOP.create({
      title: title.trim(),
      description: description?.trim() || '',
      steps: steps || [],
      status: status === 'published' ? 'published' : 'draft',
      createdBy: admin?._id,
      version: 1,
    });
    await sop.populate('steps.department', DEPT_SELECT);
    res.status(201).json(sop);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/sops/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, steps, status } = req.body as {
      title?: string; description?: string; steps?: unknown[]; status?: string;
    };
    const set: Record<string, unknown> = {};
    if (title !== undefined) set.title = title.trim();
    if (description !== undefined) set.description = description.trim();
    if (steps !== undefined) set.steps = steps;
    if (status !== undefined) set.status = status;

    const update: Record<string, unknown> = { $set: set };
    if (steps !== undefined) update.$inc = { version: 1 };

    const sop = await WorkspaceSOP.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('steps.department', DEPT_SELECT)
      .populate('createdBy', 'name email');
    if (!sop) return res.status(404).json({ error: 'Not found' });
    res.json(sop);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sops/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const sop = await WorkspaceSOP.findByIdAndDelete(req.params.id);
    if (!sop) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sops/:id/generate — manually (re)generate Tasks for a project
router.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const admin = await WorkspaceUser.findOne({ role: 'admin', isActive: true });
    if (!admin) return res.status(500).json({ error: 'No admin user found to attribute generated tasks to' });

    await generateTasksFromSOP(req.params.id, projectId, admin._id as any);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

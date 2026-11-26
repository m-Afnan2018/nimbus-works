import { Request, Response } from 'express';
import SOP from '../models/SOP';
import Task from '../models/Task';
import { generateTasksFromSOP, deleteSOPRun } from '../utils/sopTaskGenerator';

const DEPT_SELECT = 'name color';

export const getSOPs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sops = await SOP.find()
      .populate('steps.department', DEPT_SELECT)
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(sops);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getSOP = async (req: Request, res: Response): Promise<void> => {
  try {
    const sop = await SOP.findById(req.params.id)
      .populate('steps.department', DEPT_SELECT)
      .populate('createdBy', 'name email');
    if (!sop) { res.status(404).json({ message: 'SOP not found.' }); return; }
    res.json(sop);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createSOP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, steps, status } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ message: 'SOP title is required.' });
      return;
    }
    const sop = await SOP.create({
      title: title.trim(),
      description: description?.trim() || '',
      steps: steps || [],
      status: status === 'published' ? 'published' : 'draft',
      createdBy: req.user!.id,
      version: 1,
    });
    await sop.populate('steps.department', DEPT_SELECT);
    res.status(201).json(sop);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateSOP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, steps, status } = req.body;
    const set: Record<string, unknown> = {};
    if (title !== undefined) set.title = title.trim();
    if (description !== undefined) set.description = description.trim();
    if (steps !== undefined) set.steps = steps;
    if (status !== undefined) set.status = status;

    const update: Record<string, unknown> = { $set: set };
    if (steps !== undefined) update.$inc = { version: 1 };

    const sop = await SOP.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('steps.department', DEPT_SELECT)
      .populate('createdBy', 'name email');
    if (!sop) { res.status(404).json({ message: 'SOP not found.' }); return; }
    res.json(sop);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteSOP = async (req: Request, res: Response): Promise<void> => {
  try {
    const sop = await SOP.findByIdAndDelete(req.params.id);
    if (!sop) { res.status(404).json({ message: 'SOP not found.' }); return; }
    res.json({ message: 'SOP deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const generateTasksFromSOPHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, title, assignments } = req.body as {
      projectId?: string;
      title?: string;
      assignments?: Record<number, string[]>;
    };
    if (!projectId) {
      res.status(400).json({ message: 'projectId is required.' });
      return;
    }
    if (!title?.trim()) {
      res.status(400).json({ message: 'A title for this SOP run is required.' });
      return;
    }
    const { runId } = await generateTasksFromSOP(req.params.id, projectId, req.user!.id, title.trim(), assignments);
    res.json({ message: 'Tasks generated from SOP.', runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error.';
    res.status(400).json({ message });
  }
};

export const deleteSOPRunHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { runId } = req.params;
    const { projectId } = req.query as { projectId?: string };
    if (!projectId) {
      res.status(400).json({ message: 'projectId is required.' });
      return;
    }

    const runTasks = await Task.find({ project: projectId, sopRunId: runId }).select('reporter');
    if (runTasks.length === 0) {
      res.status(404).json({ message: 'SOP run not found.' });
      return;
    }

    const isManager = req.user!.role === 'admin' || req.user!.role === 'manager';
    const isOwner = runTasks.every((t) => t.reporter.toString() === req.user!.id);
    if (!isManager && !isOwner) {
      res.status(403).json({ message: 'Only the person who started this run (or an admin/manager) can delete it.' });
      return;
    }

    const deletedCount = await deleteSOPRun(projectId, runId);
    res.json({ message: 'SOP run deleted.', deletedCount });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

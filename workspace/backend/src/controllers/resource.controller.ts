import { Request, Response } from 'express';
import Resource from '../models/Resource';
import User from '../models/User';

export const getResources = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      filter.assignedTo = req.user?.id;
    }
    if (req.query.userId) filter.assignedTo = req.query.userId;
    if (req.query.category) filter.category = req.query.category;
    if (typeof req.query.active !== 'undefined') filter.isActive = req.query.active === 'true';

    const resources = await Resource.find(filter)
      .populate({ path: 'assignedTo', model: User, select: 'name email avatar department' })
      .populate({ path: 'assignedBy', model: User, select: 'name' })
      .sort({ assignedAt: -1 });

    res.json(resources);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getResource = async (req: Request, res: Response) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate({ path: 'assignedTo', model: User, select: 'name email avatar department' })
      .populate({ path: 'assignedBy', model: User, select: 'name' });
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });
    res.json(resource);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createResource = async (req: Request, res: Response) => {
  try {
    const resource = await Resource.create({
      ...req.body,
      assignedBy: req.user?.id,
    });
    await resource.populate({ path: 'assignedTo', model: User, select: 'name email avatar department' });
    await resource.populate({ path: 'assignedBy', model: User, select: 'name' });
    res.status(201).json(resource);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const updateResource = async (req: Request, res: Response) => {
  try {
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate({ path: 'assignedTo', model: User, select: 'name email avatar department' })
      .populate({ path: 'assignedBy', model: User, select: 'name' });
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });
    res.json(resource);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });
    res.json({ message: 'Resource deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const returnResource = async (req: Request, res: Response) => {
  try {
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { isActive: false, returnedAt: new Date() },
      { new: true }
    ).populate({ path: 'assignedTo', model: User, select: 'name email avatar' });
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });
    res.json(resource);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import WorkspaceDepartment from '../models/shared/WorkspaceDepartment';
import Service from '../models/Service';

const router = Router();

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Build flat list: Service (dept) → Sub-service (template) → Type (template.types[])
async function buildFlat() {
  const [departments, metas] = await Promise.all([
    WorkspaceDepartment.find().sort({ name: 1 }),
    Service.find(),
  ]);
  const metaMap = new Map(metas.map(m => [m.workspaceId.toString(), m]));

  const flat: object[] = [];
  for (const dept of departments) {
    const meta = metaMap.get(dept._id.toString());
    flat.push({
      _id:           dept._id,
      name:          dept.name,
      slug:          slugify(dept.name),
      parentId:      null,
      grandParentId: null,
      level:         0,
      icon:          dept.canSocialMedia ? 'ti-brand-instagram' : 'ti-briefcase',
      color:         meta?.color ?? dept.color ?? 'indigo',
      order:         0,
      description:   dept.description,
      clientPrice:   meta?.clientPrice,
      employeePrice: meta?.employeePrice,
      sopId:         meta?.sopId ?? null,
      source:        'workspace',
      createdAt:     dept.createdAt,
      updatedAt:     dept.updatedAt,
    });

    for (let i = 0; i < (dept.taskTemplates ?? []).length; i++) {
      const t     = dept.taskTemplates[i];
      const tmeta = metaMap.get(t._id.toString());
      flat.push({
        _id:            t._id,
        name:           t.title,
        slug:           slugify(t.title),
        parentId:       dept._id,
        grandParentId:  null,
        level:          1,
        icon:           'ti-point',
        color:          tmeta?.color ?? dept.color ?? 'indigo',
        order:          i,
        description:    t.description ?? '',
        estimatedHours: t.estimatedHours,
        priority:       t.priority,
        clientPrice:    tmeta?.clientPrice,
        employeePrice:  tmeta?.employeePrice,
        sopId:          tmeta?.sopId ?? null,
        source:         'workspace',
      });

      for (let j = 0; j < ((t as any).types ?? []).length; j++) {
        const ty     = (t as any).types[j];
        const tymeta = metaMap.get(ty._id.toString());
        flat.push({
          _id:            ty._id,
          name:           ty.title,
          slug:           slugify(ty.title),
          parentId:       t._id,
          grandParentId:  dept._id,
          level:          2,
          icon:           'ti-circle',
          color:          tmeta?.color ?? dept.color ?? 'indigo',
          order:          j,
          description:    ty.description ?? '',
          estimatedHours: ty.estimatedHours,
          priority:       ty.priority,
          clientPrice:    tymeta?.clientPrice,
          employeePrice:  tymeta?.employeePrice,
          sopId:          tymeta?.sopId ?? null,
          source:         'workspace',
        });
      }
    }
  }
  return flat;
}

// GET /api/services
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await buildFlat());
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/services/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dept = await WorkspaceDepartment.findById(req.params.id)
      .populate('heads', 'name avatar')
      .populate('members', 'name avatar');
    if (!dept) return res.status(404).json({ error: 'Not found' });
    res.json(dept);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/services — create Service (dept) or Sub-service (taskTemplate)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color, parentId, clientPrice, employeePrice, sopId } = req.body as {
      name?: string; color?: string; parentId?: string | null;
      clientPrice?: number; employeePrice?: number; sopId?: string | null;
    };

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    if (!parentId) {
      const dept = await WorkspaceDepartment.create({
        name: name.trim(),
        color: color || 'indigo',
        description: '',
        heads: [],
        members: [],
        canSocialMedia: false,
        taskTemplates: [],
      });

      await Service.create({
        workspaceId:    dept._id,
        name:         name.trim(),
        slug:         slugify(name.trim()),
        parentId:     null,
        color:        color || 'indigo',
        clientPrice,
        employeePrice,
        sopId:        sopId || null,
      });

      return res.status(201).json({
        _id: dept._id, name: dept.name, slug: slugify(dept.name),
        parentId: null, grandParentId: null, level: 0, color: dept.color, clientPrice, employeePrice, sopId: sopId || null,
      });
    }

    // Sub-service → taskTemplate inside parent department
    const dept = await WorkspaceDepartment.findById(parentId);
    if (!dept) return res.status(404).json({ error: 'Parent service not found' });

    dept.taskTemplates.push({ title: name.trim(), priority: 'medium', types: [] } as any);
    await dept.save();
    const tmpl = dept.taskTemplates[dept.taskTemplates.length - 1];

    await Service.create({
      workspaceId:    tmpl._id,
      name:         name.trim(),
      slug:         slugify(name.trim()),
      parentId:     dept._id,
      color:        color || dept.color || 'indigo',
      clientPrice,
      employeePrice,
      sopId:        sopId || null,
    });

    return res.status(201).json({
      _id: tmpl._id, name: tmpl.title, slug: slugify(tmpl.title),
      parentId: dept._id, grandParentId: null, level: 1, color: color || dept.color, clientPrice, employeePrice, sopId: sopId || null,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/services/:subServiceId/types — add a Type to a Sub-service
router.post('/:subServiceId/types', async (req: Request, res: Response) => {
  try {
    const { name, priority, estimatedHours, description, clientPrice, employeePrice, sopId } = req.body as {
      name?: string; priority?: string; estimatedHours?: number; description?: string;
      clientPrice?: number; employeePrice?: number; sopId?: string | null;
    };
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const parent = await WorkspaceDepartment.findOne({ 'taskTemplates._id': req.params.subServiceId });
    if (!parent) return res.status(404).json({ error: 'Sub-service not found' });

    const tmpl = parent.taskTemplates.find(t => t._id.toString() === req.params.subServiceId);
    if (!tmpl) return res.status(404).json({ error: 'Sub-service not found' });

    (tmpl as any).types.push({
      title: name.trim(),
      description: description?.trim() || '',
      priority: priority || 'medium',
      estimatedHours: estimatedHours ?? undefined,
    });
    await parent.save();

    const newType = (tmpl as any).types[(tmpl as any).types.length - 1];

    await Service.create({
      workspaceId:    newType._id,
      name:         newType.title,
      slug:         slugify(newType.title),
      parentId:     tmpl._id,
      clientPrice,
      employeePrice,
      sopId:        sopId || null,
    });

    return res.status(201).json({
      _id: newType._id, name: newType.title, slug: slugify(newType.title),
      parentId: tmpl._id, grandParentId: parent._id, level: 2,
      priority: newType.priority, estimatedHours: newType.estimatedHours,
      clientPrice, employeePrice, sopId: sopId || null,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/services/:id — update Service or Sub-service
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, color, clientPrice, employeePrice, sopId } = req.body as {
      name?: string; color?: string; clientPrice?: number; employeePrice?: number; sopId?: string | null;
    };
    const id = new mongoose.Types.ObjectId(req.params.id);

    const dept = await WorkspaceDepartment.findById(id);
    if (dept) {
      if (name?.trim()) dept.name = name.trim();
      if (color)        dept.color = color;
      await dept.save();

      const set: Record<string, unknown> = { name: dept.name, color: dept.color, clientPrice, employeePrice };
      if (sopId !== undefined) set.sopId = sopId || null;
      await Service.findOneAndUpdate({ workspaceId: id }, { $set: set }, { upsert: true });

      return res.json({ _id: dept._id, name: dept.name, color: dept.color, clientPrice, employeePrice, sopId });
    }

    const parent = await WorkspaceDepartment.findOne({ 'taskTemplates._id': id });
    if (!parent) return res.status(404).json({ error: 'Service not found' });

    const tmpl = parent.taskTemplates.find(t => t._id.toString() === req.params.id);
    if (!tmpl) return res.status(404).json({ error: 'Service not found' });

    if (name?.trim()) tmpl.title = name.trim();
    await parent.save();

    const subSet: Record<string, unknown> = { name: tmpl.title, color, clientPrice, employeePrice };
    if (sopId !== undefined) subSet.sopId = sopId || null;
    await Service.findOneAndUpdate({ workspaceId: id }, { $set: subSet }, { upsert: true });

    return res.json({ _id: tmpl._id, name: tmpl.title, parentId: parent._id, color, clientPrice, employeePrice, sopId });
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/services/:subServiceId/types/:typeId — update a Type
router.put('/:subServiceId/types/:typeId', async (req: Request, res: Response) => {
  try {
    const { name, priority, estimatedHours, description, clientPrice, employeePrice, sopId } = req.body as {
      name?: string; priority?: string; estimatedHours?: number; description?: string;
      clientPrice?: number; employeePrice?: number; sopId?: string | null;
    };

    const parent = await WorkspaceDepartment.findOne({ 'taskTemplates._id': req.params.subServiceId });
    if (!parent) return res.status(404).json({ error: 'Sub-service not found' });

    const tmpl = parent.taskTemplates.find(t => t._id.toString() === req.params.subServiceId);
    if (!tmpl) return res.status(404).json({ error: 'Sub-service not found' });

    const typ = (tmpl as any).types.find((ty: any) => ty._id.toString() === req.params.typeId);
    if (!typ) return res.status(404).json({ error: 'Type not found' });

    if (name?.trim()) typ.title = name.trim();
    if (description !== undefined) typ.description = description.trim();
    if (priority) typ.priority = priority;
    if (estimatedHours !== undefined) typ.estimatedHours = estimatedHours;
    await parent.save();

    const set: Record<string, unknown> = { name: typ.title, parentId: tmpl._id, clientPrice, employeePrice };
    if (sopId !== undefined) set.sopId = sopId || null;
    await Service.findOneAndUpdate({ workspaceId: typ._id }, { $set: set }, { upsert: true });

    return res.json({
      _id: typ._id, name: typ.title, parentId: tmpl._id, grandParentId: parent._id, level: 2,
      priority: typ.priority, estimatedHours: typ.estimatedHours, clientPrice, employeePrice, sopId,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/services/:id — delete Service or Sub-service
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);

    const dept = await WorkspaceDepartment.findByIdAndDelete(id);
    if (dept) {
      const ids = [id as any];
      for (const t of dept.taskTemplates) {
        ids.push(t._id);
        for (const ty of ((t as any).types ?? [])) ids.push(ty._id);
      }
      await Service.deleteMany({ workspaceId: { $in: ids } });
      return res.json({ ok: true });
    }

    const parent = await WorkspaceDepartment.findOne({ 'taskTemplates._id': id });
    if (!parent) return res.status(404).json({ error: 'Service not found' });

    const tmpl     = parent.taskTemplates.find(t => t._id.toString() === req.params.id);
    const typeIds  = ((tmpl as any)?.types ?? []).map((ty: any) => ty._id);

    parent.taskTemplates = parent.taskTemplates.filter(
      t => t._id.toString() !== req.params.id
    ) as any;
    await parent.save();
    await Service.deleteMany({ workspaceId: { $in: [id, ...typeIds] } });

    return res.json({ ok: true });
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/services/:subServiceId/types/:typeId — delete a Type
router.delete('/:subServiceId/types/:typeId', async (req: Request, res: Response) => {
  try {
    const parent = await WorkspaceDepartment.findOne({ 'taskTemplates._id': req.params.subServiceId });
    if (!parent) return res.status(404).json({ error: 'Sub-service not found' });

    const tmpl = parent.taskTemplates.find(t => t._id.toString() === req.params.subServiceId);
    if (!tmpl) return res.status(404).json({ error: 'Sub-service not found' });

    (tmpl as any).types = (tmpl as any).types.filter((ty: any) => ty._id.toString() !== req.params.typeId);
    await parent.save();
    await Service.deleteOne({ workspaceId: req.params.typeId });

    return res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

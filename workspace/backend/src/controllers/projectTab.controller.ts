import { Request, Response } from 'express';
import Project from '../models/Project';
import ProjectTab from '../models/ProjectTab';
import TableInstance from '../models/TableInstance';
import CustomTable from '../models/Table';
import { formatPeriodName, parsePeriod } from '../utils/period';

export const createProjectTab = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, templateId } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Tab name is required.' }); return; }

    const project = await Project.findById(req.params.id);
    if (!project) { res.status(404).json({ message: 'Project not found.' }); return; }

    let defaultTemplate: string | undefined;
    if (templateId) {
      const table = await CustomTable.findById(templateId);
      if (!table) { res.status(404).json({ message: 'Template not found.' }); return; }
      defaultTemplate = table._id.toString();
    }

    const tab = await ProjectTab.create({
      project: project._id,
      name: name.trim(),
      order: project.tabs.length,
      defaultTemplate,
      createdBy: req.user!.id,
    });

    project.tabs.push(tab._id as typeof project.tabs[number]);
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('tableInstances', 'name color sourceTable')
      .populate({ path: 'tabs', select: 'name order defaultTemplate', populate: { path: 'defaultTemplate', select: 'name color' } });
    res.status(201).json(updated);
  } catch (error) {
    console.error('createProjectTab error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateProjectTab = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, templateId } = req.body;
    const patch: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name.trim()) { res.status(400).json({ message: 'Tab name is required.' }); return; }
      patch.name = name.trim();
    }

    if (templateId !== undefined) {
      if (templateId === null) {
        patch.defaultTemplate = undefined;
      } else {
        const table = await CustomTable.findById(templateId);
        if (!table) { res.status(404).json({ message: 'Template not found.' }); return; }
        patch.defaultTemplate = table._id;
      }
    }

    const update = templateId === null ? { $set: patch, $unset: { defaultTemplate: 1 } } : { $set: patch };
    const tab = await ProjectTab.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('defaultTemplate', 'name color');
    if (!tab) { res.status(404).json({ message: 'Tab not found.' }); return; }
    res.json(tab);
  } catch (error) {
    console.error('updateProjectTab error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteProjectTab = async (req: Request, res: Response): Promise<void> => {
  try {
    const tab = await ProjectTab.findById(req.params.id);
    if (!tab) { res.status(404).json({ message: 'Tab not found.' }); return; }

    await TableInstance.deleteMany({ tab: tab._id });
    await Project.findByIdAndUpdate(tab.project, { $pull: { tabs: tab._id } });
    await tab.deleteOne();

    res.json({ message: 'Tab deleted.' });
  } catch (error) {
    console.error('deleteProjectTab error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getProjectTabInstances = async (req: Request, res: Response): Promise<void> => {
  try {
    const instances = await TableInstance.find({ tab: req.params.id })
      .select('name periodMonth periodYear color sourceTable createdBy createdAt updatedAt')
      .populate('createdBy', 'name')
      .sort({ periodYear: 1, periodMonth: 1, createdAt: 1 });
    res.json(instances);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const attachTableToTab = async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodMonth, periodYear } = req.body;
    let { tableId } = req.body;

    const tab = await ProjectTab.findById(req.params.id);
    if (!tab) { res.status(404).json({ message: 'Tab not found.' }); return; }

    if (!tableId && tab.defaultTemplate) tableId = tab.defaultTemplate.toString();
    if (!tableId) { res.status(400).json({ message: 'tableId is required (or set a default template on this tab).' }); return; }

    const table = await CustomTable.findById(tableId);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }
    if (!table.isActive) { res.status(400).json({ message: 'This table is deactivated.' }); return; }

    const period = parsePeriod(periodMonth, periodYear);
    if (!period) { res.status(400).json({ message: 'A valid month and year are required.' }); return; }

    const instance = await TableInstance.create({
      project: tab.project,
      tab: tab._id,
      sourceTable: table._id,
      name: formatPeriodName(period.month, period.year),
      periodMonth: period.month,
      periodYear: period.year,
      color: table.color,
      columns: table.columns.map((c) => ({ key: c.key, label: c.label, type: c.type, order: c.order, autoFill: c.autoFill, options: c.options, width: c.width })),
      rows: [],
      createdBy: req.user!.id,
    });

    res.status(201).json(instance);
  } catch (error) {
    console.error('attachTableToTab error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

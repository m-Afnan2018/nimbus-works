import { Request, Response } from 'express';
import mongoose from 'mongoose';
import CustomTable, { ColumnType, AutoFill } from '../models/Table';
import TableInstance from '../models/TableInstance';

const COLUMN_TYPES: ColumnType[] = ['text', 'content', 'number', 'date', 'time', 'link', 'color', 'checkbox'];
const AUTO_FILLS: AutoFill[] = ['none', 'serial', 'today', 'now'];

/** 'serial' only makes sense on number columns, 'today' only on date columns, 'now' only on time columns. */
function resolveAutoFill(type: ColumnType, autoFill?: AutoFill): AutoFill {
  if (!autoFill || !AUTO_FILLS.includes(autoFill)) return 'none';
  if (autoFill === 'serial' && type !== 'number') return 'none';
  if (autoFill === 'today' && type !== 'date') return 'none';
  if (autoFill === 'now' && type !== 'time') return 'none';
  return autoFill;
}

/** Dropdown options only apply to text columns; trims, drops blanks/dupes, caps the list. */
function resolveOptions(type: ColumnType, options?: unknown): string[] {
  if (type !== 'text' || !Array.isArray(options)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of options) {
    const v = String(raw).trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    cleaned.push(v);
    if (cleaned.length >= 50) break;
  }
  return cleaned;
}

export const getTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.active === 'true') filter.isActive = true;
    const tables = await CustomTable.find(filter)
      .select('name description color isActive columns createdBy createdAt updatedAt')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 });

    const projectCounts = await TableInstance.aggregate([
      { $group: { _id: '$sourceTable', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(projectCounts.map((p) => [p._id.toString(), p.count]));

    const result = tables.map((t) => ({
      ...t.toObject(),
      columnCount: t.columns.length,
      projectCount: countMap.get((t._id as mongoose.Types.ObjectId).toString()) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('getTables error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = await CustomTable.findById(req.params.id).populate('createdBy', 'name');
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }
    res.json(table);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Table name is required.' }); return; }

    const table = await CustomTable.create({
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#6366f1',
      columns: [],
      isActive: true,
      createdBy: req.user!.id,
    });
    res.status(201).json(table);
  } catch (error) {
    console.error('createTable error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description.trim();
    if (color !== undefined) patch.color = color;

    const table = await CustomTable.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }
    res.json(table);
  } catch (error) {
    console.error('updateTable error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const toggleTableActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = await CustomTable.findById(req.params.id);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }
    table.isActive = !table.isActive;
    await table.save();
    res.json(table);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const inUse = await TableInstance.exists({ sourceTable: req.params.id });
    if (inUse) {
      res.status(400).json({ message: 'This table is attached to a project. Deactivate it, or remove it from all projects first.' });
      return;
    }
    const table = await CustomTable.findByIdAndDelete(req.params.id);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }
    res.json({ message: 'Table deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ── Columns (schema only — templates carry no row data) ───────────────

export const addColumn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, type, autoFill, options } = req.body;
    if (!label?.trim()) { res.status(400).json({ message: 'Column label is required.' }); return; }
    if (type && !COLUMN_TYPES.includes(type)) { res.status(400).json({ message: 'Invalid column type.' }); return; }

    const table = await CustomTable.findById(req.params.id);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }

    const resolvedType: ColumnType = type || 'text';
    const order = table.columns.length;
    table.columns.push({
      key: new mongoose.Types.ObjectId().toHexString(),
      label: label.trim(),
      type: resolvedType,
      order,
      autoFill: resolveAutoFill(resolvedType, autoFill),
      options: resolveOptions(resolvedType, options),
    } as any);
    await table.save();
    res.status(201).json(table);
  } catch (error) {
    console.error('addColumn error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateColumn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, type, autoFill, options } = req.body;
    if (type && !COLUMN_TYPES.includes(type)) { res.status(400).json({ message: 'Invalid column type.' }); return; }

    const table = await CustomTable.findById(req.params.id);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }

    const col = (table.columns as any).id(req.params.columnId);
    if (!col) { res.status(404).json({ message: 'Column not found.' }); return; }

    if (label !== undefined) col.label = label.trim();
    if (type !== undefined) col.type = type;
    if (autoFill !== undefined || type !== undefined) {
      col.autoFill = resolveAutoFill(col.type, autoFill !== undefined ? autoFill : col.autoFill);
    }
    if (options !== undefined || type !== undefined) {
      col.options = resolveOptions(col.type, options !== undefined ? options : col.options);
    }
    await table.save();
    res.json(table);
  } catch (error) {
    console.error('updateColumn error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteColumn = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = await CustomTable.findById(req.params.id);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }

    const col = (table.columns as any).id(req.params.columnId);
    if (!col) { res.status(404).json({ message: 'Column not found.' }); return; }

    col.deleteOne();
    await table.save();
    res.json(table);
  } catch (error) {
    console.error('deleteColumn error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const reorderColumns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { columnIds } = req.body as { columnIds: string[] };
    if (!Array.isArray(columnIds)) { res.status(400).json({ message: 'columnIds must be an array.' }); return; }

    const table = await CustomTable.findById(req.params.id);
    if (!table) { res.status(404).json({ message: 'Table not found.' }); return; }

    const orderMap = new Map(columnIds.map((id, i) => [id, i]));
    for (const col of table.columns as any) {
      const idx = orderMap.get(col._id.toString());
      if (idx !== undefined) col.order = idx;
    }
    table.columns.sort((a, b) => a.order - b.order);
    await table.save();
    res.json(table);
  } catch (error) {
    console.error('reorderColumns error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

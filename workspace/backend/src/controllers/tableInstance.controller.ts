import { Request, Response } from 'express';
import TableInstance, { ITableInstance } from '../models/TableInstance';
import Project from '../models/Project';
import { formatPeriodName, parsePeriod } from '../utils/period';

/** Fills in serial numbers / today's date for auto-fill columns, unless the caller already supplied a value. */
function computeAutoFillCells(instance: ITableInstance, providedCells: Record<string, unknown>): Record<string, unknown> {
  const cells: Record<string, unknown> = { ...providedCells };

  for (const col of instance.columns) {
    if (cells[col.key] !== undefined) continue;

    if (col.autoFill === 'serial') {
      let max = 0;
      for (const row of instance.rows) {
        const v = Number(row.cells?.[col.key]);
        if (Number.isFinite(v) && v > max) max = v;
      }
      cells[col.key] = max + 1;
    } else if (col.autoFill === 'today') {
      cells[col.key] = new Date().toISOString().slice(0, 10);
    } else if (col.autoFill === 'now') {
      const now = new Date();
      cells[col.key] = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }

  return cells;
}

export const getTableInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const instance = await TableInstance.findById(req.params.id).populate('createdBy', 'name');
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }
    res.json(instance);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const renameTableInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodMonth, periodYear } = req.body;
    const period = parsePeriod(periodMonth, periodYear);
    if (!period) { res.status(400).json({ message: 'A valid month and year are required.' }); return; }

    const instance = await TableInstance.findByIdAndUpdate(
      req.params.id,
      { name: formatPeriodName(period.month, period.year), periodMonth: period.month, periodYear: period.year },
      { new: true, runValidators: true }
    );
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }
    res.json(instance);
  } catch (error) {
    console.error('renameTableInstance error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteTableInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const instance = await TableInstance.findById(req.params.id);
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }

    if (!instance.tab) {
      await Project.findByIdAndUpdate(instance.project, { $pull: { tableInstances: instance._id } });
    }
    await instance.deleteOne();
    res.json({ message: 'Table deleted.' });
  } catch (error) {
    console.error('deleteTableInstance error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateColumnWidth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { width } = req.body;
    const w = Number(width);
    if (!Number.isFinite(w)) { res.status(400).json({ message: 'width must be a number.' }); return; }

    const instance = await TableInstance.findById(req.params.id);
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }

    const col = (instance.columns as any).id(req.params.columnId);
    if (!col) { res.status(404).json({ message: 'Column not found.' }); return; }

    col.width = Math.min(800, Math.max(60, Math.round(w)));
    await instance.save();
    res.json(instance);
  } catch (error) {
    console.error('updateColumnWidth error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addRow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cells } = req.body;
    const instance = await TableInstance.findById(req.params.id);
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }

    const order = instance.rows.length;
    instance.rows.push({ cells: computeAutoFillCells(instance, cells || {}), order } as any);
    await instance.save();
    res.status(201).json(instance);
  } catch (error) {
    console.error('addRow error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateRow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cells } = req.body;
    const instance = await TableInstance.findById(req.params.id);
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }

    const row = (instance.rows as any).id(req.params.rowId);
    if (!row) { res.status(404).json({ message: 'Row not found.' }); return; }

    row.cells = { ...row.cells, ...(cells || {}) };
    instance.markModified('rows');
    await instance.save();
    res.json(instance);
  } catch (error) {
    console.error('updateRow error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteRow = async (req: Request, res: Response): Promise<void> => {
  try {
    const instance = await TableInstance.findById(req.params.id);
    if (!instance) { res.status(404).json({ message: 'Table not found.' }); return; }

    const row = (instance.rows as any).id(req.params.rowId);
    if (!row) { res.status(404).json({ message: 'Row not found.' }); return; }

    row.deleteOne();
    await instance.save();
    res.json(instance);
  } catch (error) {
    console.error('deleteRow error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

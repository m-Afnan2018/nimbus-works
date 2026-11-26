import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import WorkspaceUser from '../models/shared/WorkspaceUser';
import EmployeeMeta from '../models/EmployeeMeta';

const router = Router();

const COLOR_CYCLE = ['emerald', 'indigo', 'blue', 'amber', 'red'] as const;

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function buildShape(u: any, meta: any, idx: number) {
  return {
    _id:              u._id,
    name:             u.name,
    email:            u.email,
    role:             u.role,
    avatar:           u.avatar,
    isActive:         u.isActive ?? true,
    department:       meta?.department       ?? '',
    baseSalary:       meta?.baseSalary       ?? 0,
    hra:              meta?.hra              ?? 0,
    specialAllowance: meta?.specialAllowance ?? 0,
    incentives:       meta?.incentives       ?? 0,
    providentFund:    meta?.providentFund    ?? 0,
    esi:              meta?.esi              ?? 0,
    professionalTax:  meta?.professionalTax  ?? 0,
    tds:              meta?.tds              ?? 0,
    deductions:       meta?.deductions       ?? 0,
    finalSalary:      meta?.finalSalary      ?? 0,
    status:           'Pending' as const,
    initials:         initials(u.name),
    colorKey:         meta?.colorKey ?? COLOR_CYCLE[idx % COLOR_CYCLE.length],
  };
}

// Used by salaryRecords /run — only active employees get payroll
export async function buildEmployeeList() {
  const [users, metas] = await Promise.all([
    WorkspaceUser.find({ isActive: true }).sort({ name: 1 }),
    EmployeeMeta.find(),
  ]);
  const metaMap = new Map(metas.map(m => [m.userId.toString(), m]));
  return users.map((u, i) => buildShape(u, metaMap.get(u._id.toString()), i));
}

// POST /api/employees — create a Workspace user + salary metadata
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name, department, baseSalary, hra, specialAllowance, incentives,
      providentFund, esi, professionalTax, tds, deductions, finalSalary, colorKey,
      email: rawEmail, password: rawPassword,
    } = req.body as Record<string, string | number>;

    if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Name is required' });

    const cleanName = String(name).trim();
    const slug      = cleanName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const email     = String(rawEmail ?? '').trim() || `${slug}.${Date.now()}@nimbusworks.internal`;
    const hashed    = await bcrypt.hash(String(rawPassword ?? '').trim() || 'Employee@2026', 12);

    const inserted = await WorkspaceUser.collection.insertOne({
      name: cleanName, email, password: hashed,
      role: 'member', isActive: true, avatar: '',
      lateThreshold: '09:30', refreshTokens: [], tokenVersion: 0,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const userId  = inserted.insertedId;
    const allUsers = await WorkspaceUser.find({ isActive: true }).sort({ name: 1 });
    const idx     = allUsers.findIndex(u => u._id.toString() === userId.toString());

    const meta = await EmployeeMeta.create({
      userId,
      department: department ?? '',
      baseSalary:       Number(baseSalary)       || 0,
      hra:              Number(hra)              || 0,
      specialAllowance: Number(specialAllowance) || 0,
      incentives:       Number(incentives)       || 0,
      providentFund:    Number(providentFund)    || 0,
      esi:              Number(esi)              || 0,
      professionalTax:  Number(professionalTax)  || 0,
      tds:              Number(tds)              || 0,
      deductions:       Number(deductions)       || 0,
      finalSalary:      Number(finalSalary)      || 0,
      colorKey:         colorKey ?? COLOR_CYCLE[Math.max(idx, 0) % COLOR_CYCLE.length],
    });

    res.status(201).json(buildShape(
      { _id: userId, name: cleanName, email, role: 'member', isActive: true },
      meta, Math.max(idx, 0),
    ));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/employees — all Workspace users (active + inactive) merged with salary metadata
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [users, metas] = await Promise.all([
      WorkspaceUser.find().sort({ isActive: -1, name: 1 }),  // active first
      EmployeeMeta.find(),
    ]);
    const metaMap = new Map(metas.map(m => [m.userId.toString(), m]));
    res.json(users.map((u, i) => buildShape(u, metaMap.get(u._id.toString()), i)));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/employees/:id — update salary metadata; also handles reactivation via { isActive: true }
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await WorkspaceUser.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Employee not found' });

    const {
      isActive,
      department, baseSalary, hra, specialAllowance, incentives,
      providentFund, esi, professionalTax, tds, deductions, finalSalary, colorKey,
    } = req.body;

    if (typeof isActive === 'boolean') {
      await WorkspaceUser.findByIdAndUpdate(req.params.id, { isActive });
      user.isActive = isActive;
    }

    const meta = await EmployeeMeta.findOneAndUpdate(
      { userId: req.params.id },
      { $set: { department, baseSalary, hra, specialAllowance, incentives, providentFund, esi, professionalTax, tds, deductions, finalSalary, colorKey } },
      { new: true, upsert: true, runValidators: true },
    );

    const allUsers = await WorkspaceUser.find().sort({ isActive: -1, name: 1 });
    const idx = allUsers.findIndex(u => u._id.toString() === req.params.id);

    res.json(buildShape(user, meta, Math.max(idx, 0)));
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(400).json({ error: 'Invalid data' });
  }
});

// DELETE /api/employees/:id — always deactivates (isActive: false); never hard-deletes
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await WorkspaceUser.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Employee not found' });

    await WorkspaceUser.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ action: 'deactivated', message: `${user.name} has been deactivated.` });
  } catch (e) {
    if (e instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

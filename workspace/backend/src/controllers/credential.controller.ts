import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Credential from '../models/Credential';
import Department, { IDepartment } from '../models/Department';
import { decryptSecret } from '../utils/crypto';

function includesId(list: Types.ObjectId[], userId: string): boolean {
  return list.some((id) => id.toString() === userId);
}

function canManage(dept: IDepartment | undefined, role: string, userId: string): boolean {
  if (role === 'admin') return true;
  if (!dept) return false;
  return includesId(dept.heads, userId);
}

function canView(
  cred: { visibility: string; allowedUsers: Types.ObjectId[] },
  dept: IDepartment | undefined,
  role: string,
  userId: string,
): boolean {
  if (role === 'admin') return true;
  if (!dept) return false;
  if (includesId(dept.heads, userId)) return true;
  if (cred.visibility === 'restricted') return includesId(cred.allowedUsers, userId);
  return includesId(dept.members, userId);
}

// Departments the current user is a head or member of (admins get everything) —
// used to filter credential lists without an N+1 department lookup per credential.
async function relevantDepartments(role: string, userId: string): Promise<Map<string, IDepartment>> {
  const filter = role === 'admin' ? {} : { $or: [{ heads: userId }, { members: userId }] };
  const depts = await Department.find(filter).select('heads members');
  return new Map(depts.map((d) => [(d._id as Types.ObjectId).toString(), d]));
}

export const getCredentials = async (req: Request, res: Response) => {
  try {
    const { project, department } = req.query as { project?: string; department?: string };
    const filter: Record<string, unknown> = {};
    if (project) filter.project = project;
    if (department) filter.department = department;

    const role = req.user!.role;
    const userId = req.user!.id;
    const deptMap = await relevantDepartments(role, userId);

    const credentials = await Credential.find(filter)
      .populate('project', 'title')
      .populate('department', 'name color')
      .populate('createdBy', 'name avatar')
      .sort({ createdAt: -1 });

    const visible = credentials.filter((c) =>
      canView(c, deptMap.get(c.department._id.toString()), role, userId),
    );

    res.json(visible);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getExpiringCredentials = async (req: Request, res: Response) => {
  try {
    const withinDays = Number(req.query.withinDays) || 30;
    const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

    const role = req.user!.role;
    const userId = req.user!.id;
    const deptMap = await relevantDepartments(role, userId);

    const credentials = await Credential.find({ expiryDate: { $ne: null, $lte: cutoff } })
      .populate('project', 'title')
      .populate('department', 'name color')
      .sort({ expiryDate: 1 });

    const visible = credentials.filter((c) =>
      canView(c, deptMap.get(c.department._id.toString()), role, userId),
    );

    res.json(visible);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getCredential = async (req: Request, res: Response) => {
  try {
    const cred = await Credential.findById(req.params.id)
      .populate('project', 'title')
      .populate('department', 'name color heads members')
      .populate('createdBy', 'name avatar');
    if (!cred) return res.status(404).json({ message: 'Credential not found.' });

    const dept = cred.department as unknown as IDepartment;
    if (!canView(cred, dept, req.user!.role, req.user!.id)) {
      return res.status(403).json({ message: 'You do not have access to this credential.' });
    }

    res.json(cred);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createCredential = async (req: Request, res: Response) => {
  try {
    const { department, secret } = req.body as { department?: string; secret?: string };
    if (!department) return res.status(400).json({ message: 'Department is required.' });
    if (!secret) return res.status(400).json({ message: 'Secret is required.' });

    const dept = await Department.findById(department).select('heads members');
    if (!dept) return res.status(404).json({ message: 'Department not found.' });
    if (!canManage(dept, req.user!.role, req.user!.id)) {
      return res.status(403).json({ message: 'Only the department head or an admin can add credentials here.' });
    }

    const cred = await Credential.create({
      ...req.body,
      createdBy: req.user!.id,
      accessLog: [{ user: req.user!.id, action: 'created', at: new Date() }],
    });

    // Don't echo the encrypted/plaintext secret back on create.
    const result = cred.toObject() as unknown as Record<string, unknown>;
    delete result.secret;
    res.status(201).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const updateCredential = async (req: Request, res: Response) => {
  try {
    const cred = await Credential.findById(req.params.id).select('+accessLog');
    if (!cred) return res.status(404).json({ message: 'Credential not found.' });

    const dept = await Department.findById(cred.department).select('heads members');
    if (!canManage(dept ?? undefined, req.user!.role, req.user!.id)) {
      return res.status(403).json({ message: 'Only the department head or an admin can edit this credential.' });
    }

    const { secret, accessLog, createdBy, ...rest } = req.body as Record<string, unknown>;
    Object.assign(cred, rest);
    if (typeof secret === 'string' && secret.length > 0) {
      cred.secret = secret; // pre-save hook re-encrypts since it's modified
    }
    cred.accessLog.push({ user: new Types.ObjectId(req.user!.id), action: 'updated', at: new Date() } as never);
    await cred.save();

    const result = cred.toObject() as unknown as Record<string, unknown>;
    delete result.secret;
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const deleteCredential = async (req: Request, res: Response) => {
  try {
    const cred = await Credential.findById(req.params.id);
    if (!cred) return res.status(404).json({ message: 'Credential not found.' });

    const dept = await Department.findById(cred.department).select('heads members');
    if (!canManage(dept ?? undefined, req.user!.role, req.user!.id)) {
      return res.status(403).json({ message: 'Only the department head or an admin can delete this credential.' });
    }

    await cred.deleteOne();
    res.json({ message: 'Credential deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const revealCredential = async (req: Request, res: Response) => {
  try {
    const cred = await Credential.findById(req.params.id).select('+secret +accessLog');
    if (!cred) return res.status(404).json({ message: 'Credential not found.' });

    const dept = await Department.findById(cred.department).select('heads members');
    if (!canView(cred, dept ?? undefined, req.user!.role, req.user!.id)) {
      return res.status(403).json({ message: 'You do not have access to this credential.' });
    }

    cred.accessLog.push({ user: new Types.ObjectId(req.user!.id), action: 'revealed', at: new Date() } as never);
    await cred.save();

    res.json({ secret: decryptSecret(cred.secret) });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getAccessLog = async (req: Request, res: Response) => {
  try {
    const cred = await Credential.findById(req.params.id)
      .select('+accessLog')
      .populate('accessLog.user', 'name avatar')
      .populate('department', 'heads members');
    if (!cred) return res.status(404).json({ message: 'Credential not found.' });

    const dept = cred.department as unknown as IDepartment;
    if (!canManage(dept, req.user!.role, req.user!.id)) {
      return res.status(403).json({ message: 'Only the department head or an admin can view the access log.' });
    }

    res.json(cred.accessLog);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Department from '../models/Department';
import User from '../models/User';
import Conversation from '../models/Conversation';

const MEMBER_SELECT = 'name email avatar role';

// department field removed from User model — membership is tracked via Department.members[]
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function syncUserDepts(_userId: string | mongoose.Types.ObjectId): Promise<void> {}

export const getDepartments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const depts = await Department.find()
      .populate('heads', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT)
      .populate('collaborators', MEMBER_SELECT)
      .sort({ name: 1 });
    res.json(depts);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id)
      .populate('heads', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT)
      .populate('collaborators', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color, headId } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Department name is required.' });
      return;
    }
    const exists = await Department.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (exists) {
      res.status(409).json({ message: 'A department with this name already exists.' });
      return;
    }
    const dept = await Department.create({
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#6366f1',
      heads: headId ? [headId] : [],
      members: headId ? [headId] : [],
      canSocialMedia: req.body.canSocialMedia ?? false,
    });
    if (headId) {
      await syncUserDepts(headId);
    }
    await dept.populate('heads', MEMBER_SELECT);
    await dept.populate('members', MEMBER_SELECT);

    // Auto-create the department group chat
    const systemUserId = headId || req.user!.id;
    await Conversation.create({
      type: 'department',
      name: dept.name,
      participants: dept.members.map((m: any) => m._id ?? m),
      admins: dept.heads.map((h: any) => h._id ?? h),
      department: dept._id,
      createdBy: systemUserId,
    });

    res.status(201).json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color, canSocialMedia } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description.trim();
    if (color !== undefined) patch.color = color;
    if (canSocialMedia !== undefined) patch.canSocialMedia = canSocialMedia;

    const dept = await Department.findByIdAndUpdate(req.params.id, patch, { new: true })
      .populate('heads', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT)
      .populate('collaborators', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    // Recompute department string for all members when name changes
    if (name !== undefined) {
      const memberIds = dept.members.map((m) => (m as any)._id ?? m);
      await Promise.all(memberIds.map((id) => syncUserDepts(id)));
    }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    console.log(dept)
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    const memberIds = [...dept.members];
    await dept.deleteOne();
    // Recompute each member's department string (this dept is now gone)
    await Promise.all(memberIds.map((id) => syncUserDepts(id)));
    res.json({ message: 'Department deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'userId is required.' }); return; }

    let uid: mongoose.Types.ObjectId;
    try { uid = new mongoose.Types.ObjectId(userId); } catch {
      res.status(400).json({ message: 'Invalid userId.' }); return;
    }

    const user = await User.findById(uid);
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: uid } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    await syncUserDepts(uid);

    // Sync department chat group membership
    const deptConv = await Conversation.findOne({ type: 'department', department: req.params.id });
    if (deptConv && !deptConv.participants.some((p) => p.toString() === uid.toString())) {
      deptConv.participants.push(uid);
      await deptConv.save();
    }

    res.json(dept);
  } catch (err) {
    console.error('addMember error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    const userIdStr = req.params.userId;

    // Filter out the member using string comparison (avoids ObjectId casting issues)
    const before = dept.members.length;
    dept.members = dept.members.filter((m) => m.toString() !== userIdStr) as typeof dept.members;

    if (dept.members.length === before) {
      res.status(404).json({ message: 'User is not a member of this department.' });
      return;
    }

    // Remove from heads array if the removed user was a head
    dept.heads = dept.heads.filter((h) => h.toString() !== userIdStr) as typeof dept.heads;

    await dept.save();

    const populated = await Department.findById(dept._id)
      .populate('heads', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT)
      .populate('collaborators', MEMBER_SELECT);

    await syncUserDepts(userIdStr);

    // Sync department chat group membership
    await Conversation.updateOne(
      { type: 'department', department: req.params.id },
      { $pull: { participants: new (require('mongoose').Types.ObjectId)(userIdStr), admins: new (require('mongoose').Types.ObjectId)(userIdStr) } },
    );

    res.json(populated);
  } catch (err) {
    console.error('removeMember error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addHead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'userId is required.' }); return; }

    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    // userId must be a member
    if (!dept.members.map((m) => m.toString()).includes(userId)) {
      res.status(400).json({ message: 'User must be a member of this department to be set as head.' });
      return;
    }

    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { heads: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);

    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addTaskTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, estimatedHours, checklist } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ message: 'Template title is required.' });
      return;
    }
    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $push: { taskTemplates: { title: title.trim(), description: description?.trim() || '', priority: priority || 'medium', estimatedHours: estimatedHours ?? undefined, checklist: checklist || [] } } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    res.status(201).json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateTaskTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, estimatedHours, checklist } = req.body;
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch['taskTemplates.$.title'] = title.trim();
    if (description !== undefined) patch['taskTemplates.$.description'] = description.trim();
    if (priority !== undefined) patch['taskTemplates.$.priority'] = priority;
    if (estimatedHours !== undefined) patch['taskTemplates.$.estimatedHours'] = estimatedHours;
    if (checklist !== undefined) patch['taskTemplates.$.checklist'] = checklist;

    const dept = await Department.findOneAndUpdate(
      { _id: req.params.id, 'taskTemplates._id': req.params.templateId },
      { $set: patch },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department or template not found.' }); return; }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteTaskTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $pull: { taskTemplates: { _id: req.params.templateId } } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeHead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { $pull: { heads: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);

    if (!updated) { res.status(404).json({ message: 'Department not found.' }); return; }

    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addCollaborator = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'userId is required.' }); return; }

    let uid: mongoose.Types.ObjectId;
    try { uid = new mongoose.Types.ObjectId(userId); } catch {
      res.status(400).json({ message: 'Invalid userId.' }); return;
    }

    const user = await User.findById(uid);
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { collaborators: uid } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);

    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addTaskType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, estimatedHours, checklist } = req.body;
    if (!title?.trim()) { res.status(400).json({ message: 'Type title is required.' }); return; }

    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    const tmpl = (dept.taskTemplates as any).id(req.params.templateId);
    if (!tmpl) { res.status(404).json({ message: 'Template not found.' }); return; }

    tmpl.types.push({ title: title.trim(), description: description?.trim() || '', priority: priority || 'medium', estimatedHours: estimatedHours ?? undefined, checklist: checklist || [] });
    await dept.save();

    const populated = await Department.findById(dept._id)
      .populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateTaskType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, estimatedHours, checklist } = req.body;

    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    const tmpl = (dept.taskTemplates as any).id(req.params.templateId);
    if (!tmpl) { res.status(404).json({ message: 'Template not found.' }); return; }

    const typ = (tmpl.types as any).id(req.params.typeId);
    if (!typ) { res.status(404).json({ message: 'Type not found.' }); return; }

    if (title !== undefined) typ.title = title.trim();
    if (description !== undefined) typ.description = description.trim();
    if (priority !== undefined) typ.priority = priority;
    if (estimatedHours !== undefined) typ.estimatedHours = estimatedHours;
    if (checklist !== undefined) typ.checklist = checklist;
    await dept.save();

    const populated = await Department.findById(dept._id)
      .populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    res.json(populated);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteTaskType = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    const tmpl = (dept.taskTemplates as any).id(req.params.templateId);
    if (!tmpl) { res.status(404).json({ message: 'Template not found.' }); return; }

    const typ = (tmpl.types as any).id(req.params.typeId);
    if (!typ) { res.status(404).json({ message: 'Type not found.' }); return; }

    typ.deleteOne();
    await dept.save();

    const populated = await Department.findById(dept._id)
      .populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);
    res.json(populated);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeCollaborator = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { $pull: { collaborators: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    ).populate('heads', MEMBER_SELECT).populate('members', MEMBER_SELECT).populate('collaborators', MEMBER_SELECT);

    if (!updated) { res.status(404).json({ message: 'Department not found.' }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

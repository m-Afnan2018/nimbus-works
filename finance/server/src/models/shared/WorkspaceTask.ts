import mongoose, { Schema, Document, Types } from 'mongoose';
import { sharedConn } from '../../config/connections';

export interface IWorkspaceTask extends Document {
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project?: Types.ObjectId;
  department?: Types.ObjectId;
  isPersonal: boolean;
  assignees: Types.ObjectId[];
  reporter: Types.ObjectId;
  dueDate?: Date;
  dueTime?: string;
  estimatedHours?: number;
  tags: string[];
  order: number;
  dependencies: Types.ObjectId[];
  totalElapsedSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceTaskSchema = new Schema<IWorkspaceTask>(
  {
    title: String,
    description: String,
    status: String,
    priority: String,
    project: { type: Schema.Types.ObjectId, ref: 'WorkspaceProject' },
    department: { type: Schema.Types.ObjectId, ref: 'WorkspaceDepartment' },
    isPersonal: Boolean,
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reporter: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDate: Date,
    dueTime: String,
    estimatedHours: Number,
    tags: [String],
    order: { type: Number, default: 0 },
    dependencies: [{ type: Schema.Types.ObjectId, ref: 'WorkspaceTask' }],
    totalElapsedSeconds: Number,
  },
  { collection: 'tasks', timestamps: true },
);

export default sharedConn.model<IWorkspaceTask>('WorkspaceTask', WorkspaceTaskSchema);

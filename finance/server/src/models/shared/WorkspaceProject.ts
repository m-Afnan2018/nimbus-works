import mongoose, { Schema, Document, Types } from 'mongoose';
import { sharedConn } from '../../config/connections';

export type WorkspaceProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

export interface IWorkspaceProject extends Document {
  title: string;
  description: string;
  status: WorkspaceProjectStatus;
  priority: string;
  startDate?: Date;
  endDate?: Date;
  owner: Types.ObjectId;
  members: Array<{ user: Types.ObjectId; role: string }>;
  tags: string[];
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceProjectSchema = new Schema<IWorkspaceProject>(
  {
    title: String,
    description: String,
    status: String,
    priority: String,
    startDate: Date,
    endDate: Date,
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    members: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, role: String }],
    tags: [String],
    progress: Number,
  },
  { collection: 'projects', timestamps: true },
);

export default sharedConn.model<IWorkspaceProject>('WorkspaceProject', WorkspaceProjectSchema);

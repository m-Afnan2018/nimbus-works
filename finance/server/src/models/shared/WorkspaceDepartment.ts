import mongoose, { Schema, Document, Types } from 'mongoose';
import { sharedConn } from '../../config/connections';

export interface ITaskType {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  priority?: string;
  estimatedHours?: number;
}

export interface ITaskTemplate {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  priority?: string;
  estimatedHours?: number;
  types: ITaskType[];
}

export interface IWorkspaceDepartment extends Document {
  name: string;
  description: string;
  color: string;
  heads: Types.ObjectId[];
  members: Types.ObjectId[];
  canSocialMedia: boolean;
  taskTemplates: ITaskTemplate[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceDepartmentSchema = new Schema<IWorkspaceDepartment>(
  {
    name: String,
    description: String,
    color: String,
    heads: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    canSocialMedia: Boolean,
    taskTemplates: [
      {
        title: String,
        description: String,
        priority: String,
        estimatedHours: Number,
        types: [
          {
            title: String,
            description: String,
            priority: String,
            estimatedHours: Number,
          },
        ],
      },
    ],
  },
  { collection: 'departments', timestamps: true },
);

export default sharedConn.model<IWorkspaceDepartment>('WorkspaceDepartment', WorkspaceDepartmentSchema);

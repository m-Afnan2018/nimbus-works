import mongoose, { Schema, Document, Types } from 'mongoose';
import { sharedConn } from '../../config/connections';

export interface ISOPStep {
  _id: Types.ObjectId;
  order: number;
  title: string;
  description?: string;
  department: Types.ObjectId;
  taskTemplateId?: Types.ObjectId;
  typeId?: Types.ObjectId;
  estimatedHours?: number;
  dependsOn: number[];
  positionX?: number;
  positionY?: number;
}

export interface IWorkspaceSOP extends Document {
  title: string;
  description: string;
  steps: ISOPStep[];
  status: 'draft' | 'published';
  createdBy: Types.ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSOPSchema = new Schema<IWorkspaceSOP>(
  {
    title: String,
    description: String,
    steps: [
      {
        order: Number,
        title: String,
        description: String,
        department: { type: Schema.Types.ObjectId, ref: 'WorkspaceDepartment' },
        taskTemplateId: Schema.Types.ObjectId,
        typeId: Schema.Types.ObjectId,
        estimatedHours: Number,
        dependsOn: [Number],
        positionX: Number,
        positionY: Number,
      },
    ],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 1 },
  },
  { collection: 'sops', timestamps: true },
);

export default sharedConn.model<IWorkspaceSOP>('WorkspaceSOP', WorkspaceSOPSchema);

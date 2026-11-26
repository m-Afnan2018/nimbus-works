import mongoose, { Schema, Document } from 'mongoose';
import { sharedConn } from '../../config/connections';

export interface IWorkspaceUser extends Document {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceUserSchema = new Schema<IWorkspaceUser>(
  {
    name: String,
    email: String,
    role: String,
    avatar: String,
    isActive: Boolean,
  },
  { collection: 'users', timestamps: true },
);

// Registered as 'User' so Mongoose populate() using ref:'User' resolves automatically
export default sharedConn.model<IWorkspaceUser>('User', WorkspaceUserSchema);

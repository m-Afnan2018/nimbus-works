import mongoose, { Schema, Document, Types } from 'mongoose';
import { sharedConn } from '../../config/connections';

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'remote' | 'leave' | 'late';

export interface IWorkspaceAttendance extends Document {
  user: Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  lunchStart?: Date;
  lunchStop?: Date;
  lunchDuration: number;
  status: AttendanceStatus;
  workMode: 'office' | 'remote' | 'hybrid';
  hoursWorked: number;
  isLate: boolean;
  notes: Array<{ content: string; documents: string[]; links: string[]; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceAttendanceSchema = new Schema<IWorkspaceAttendance>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: Date,
    checkIn: Date,
    checkOut: Date,
    lunchStart: Date,
    lunchStop: Date,
    lunchDuration: Number,
    status: String,
    workMode: String,
    hoursWorked: Number,
    isLate: Boolean,
    notes: [
      {
        content: String,
        documents: [String],
        links: [String],
        createdAt: Date,
      },
    ],
  },
  { collection: 'attendances', timestamps: true },
);

export default sharedConn.model<IWorkspaceAttendance>('WorkspaceAttendance', WorkspaceAttendanceSchema);

import mongoose, { Schema, Document, Types } from 'mongoose';
import { privateConn } from '../config/connections';

export interface IRoomParticipant {
  user: Types.ObjectId;
  joinedAt: Date;
}

export interface IRoom extends Document {
  _id: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  participants: IRoomParticipant[];
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    maxParticipants: { type: Number, default: 10, min: 2, max: 50 },
  },
  { timestamps: true },
);

export default privateConn.model<IRoom>('Room', roomSchema);

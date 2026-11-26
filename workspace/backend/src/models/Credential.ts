import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { encryptSecret } from '../utils/crypto';

export interface ICredentialAccessLogEntry {
  user: Types.ObjectId;
  action: 'created' | 'updated' | 'revealed';
  at: Date;
}

export interface ICredential extends Document {
  title: string;
  project: Types.ObjectId;
  department: Types.ObjectId;
  category: 'domain' | 'hosting' | 'ssl' | 'social' | 'ads' | 'email' | 'other';
  username: string;
  secret: string;
  url: string;
  expiryDate?: Date;
  reminderDaysBefore: number[];
  notes: string;
  visibility: 'department' | 'restricted';
  allowedUsers: Types.ObjectId[];
  createdBy: Types.ObjectId;
  accessLog: Types.DocumentArray<ICredentialAccessLogEntry & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const credentialSchema = new Schema<ICredential>(
  {
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      maxlength: 200,
    },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required.'] },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: [true, 'Department is required.'] },
    category: {
      type: String,
      enum: ['domain', 'hosting', 'ssl', 'social', 'ads', 'email', 'other'],
      default: 'other',
    },
    username: { type: String, trim: true, default: '' },
    // Encrypted at rest (see pre-save hook below); select: false keeps it out of
    // normal find()/list responses — only the explicit reveal endpoint fetches it.
    secret: { type: String, required: [true, 'Secret is required.'], select: false },
    url: { type: String, trim: true, default: '' },
    expiryDate: { type: Date },
    reminderDaysBefore: { type: [Number], default: [30, 7, 1] },
    notes: { type: String, trim: true, default: '' },
    visibility: { type: String, enum: ['department', 'restricted'], default: 'department' },
    allowedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accessLog: {
      type: [
        {
          user: { type: Schema.Types.ObjectId, ref: 'User' },
          action: { type: String, enum: ['created', 'updated', 'revealed'] },
          at: { type: Date, default: Date.now },
        },
      ],
      select: false,
      default: [],
    },
  },
  { collection: 'credentials', timestamps: true },
);

credentialSchema.index({ project: 1 });
credentialSchema.index({ department: 1 });
credentialSchema.index({ expiryDate: 1 });

credentialSchema.pre('save', function (next) {
  if (this.isModified('secret')) {
    this.secret = encryptSecret(this.secret);
  }
  // Keep the access log bounded — this is an activity trail, not a full audit archive.
  if (this.accessLog.length > 50) {
    this.accessLog.splice(0, this.accessLog.length - 50);
  }
  next();
});

const Credential: Model<ICredential> = mongoose.model<ICredential>('Credential', credentialSchema);
export default Credential;

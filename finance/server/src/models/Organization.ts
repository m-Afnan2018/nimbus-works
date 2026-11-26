import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  gstin?: string;
  state?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  initials: string;
  colorKey: 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';
  notes?: string;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    gstin: String,
    state: String,
    address: String,
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    initials: String,
    colorKey: { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);

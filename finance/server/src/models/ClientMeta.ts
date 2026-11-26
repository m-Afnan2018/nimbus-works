import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IServiceItem {
  name: string;
  amount: number;
  type: 'Monthly' | 'One Time';
  billedPeriod?: string;
}

export interface IClientMeta extends Document {
  projectId: Types.ObjectId;
  email: string;
  monthlyBilling: number;
  serviceBreakdown: IServiceItem[];
  initials: string;
  colorKey: 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';
}

const ServiceItemSchema = new Schema<IServiceItem>(
  {
    name:         { type: String, required: true },
    amount:       { type: Number, required: true },
    type:         { type: String, enum: ['Monthly', 'One Time'], default: 'Monthly' },
    billedPeriod: { type: String },
  },
  { _id: false },
);

const ClientMetaSchema = new Schema<IClientMeta>(
  {
    projectId:        { type: Schema.Types.ObjectId, required: true, unique: true },
    email:            { type: String, default: '' },
    monthlyBilling:   { type: Number, default: 0 },
    serviceBreakdown: { type: [ServiceItemSchema], default: [] },
    initials:         { type: String, default: '' },
    colorKey:         { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
  },
  { collection: 'cfo_client_metas', timestamps: true },
);

export default mongoose.model<IClientMeta>('ClientMeta', ClientMetaSchema);

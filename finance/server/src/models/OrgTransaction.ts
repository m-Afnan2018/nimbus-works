import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IOrgTransaction extends Document {
  organization: Types.ObjectId;
  date: string;
  type: 'Revenue' | 'Expense';
  category?: string;
  description: string;
  amount: number;
  gstRate: number;
  gstAmount: number;
}

const OrgTransactionSchema = new Schema<IOrgTransaction>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    date: { type: String, required: true },
    type: { type: String, enum: ['Revenue', 'Expense'], required: true },
    category: String,
    description: String,
    amount: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

OrgTransactionSchema.index({ organization: 1, date: -1 });

export default mongoose.model<IOrgTransaction>('OrgTransaction', OrgTransactionSchema);

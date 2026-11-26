import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  type: 'Fixed' | 'Variable';
  recurring: boolean;
  payMethod?: string;
  dueDate?: string;
  paid: boolean;
  paidDate?: string;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    date: String,
    category: String,
    vendor: String,
    description: String,
    amount: Number,
    type: { type: String, enum: ['Fixed', 'Variable'], default: 'Variable' },
    recurring: { type: Boolean, default: false },
    payMethod: String,
    dueDate: String,
    paid: { type: Boolean, default: false },
    paidDate: String,
  },
  { timestamps: true }
);

export default mongoose.model<IExpense>('Expense', ExpenseSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeMeta extends Document {
  userId: mongoose.Types.ObjectId;   // Workspace user _id
  department: string;
  baseSalary: number;
  hra: number;
  specialAllowance: number;
  incentives: number;
  providentFund: number;
  esi: number;
  professionalTax: number;
  tds: number;
  deductions: number;
  finalSalary: number;
  colorKey: 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';
}

const EmployeeMetaSchema = new Schema<IEmployeeMeta>(
  {
    userId:           { type: Schema.Types.ObjectId, required: true, unique: true },
    department:       { type: String, default: '' },
    baseSalary:       { type: Number, default: 0 },
    hra:              { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    incentives:       { type: Number, default: 0 },
    providentFund:    { type: Number, default: 0 },
    esi:              { type: Number, default: 0 },
    professionalTax:  { type: Number, default: 0 },
    tds:              { type: Number, default: 0 },
    deductions:       { type: Number, default: 0 },
    finalSalary:      { type: Number, default: 0 },
    colorKey:         { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
  },
  { collection: 'cfo_employee_metas', timestamps: true },
);

export default mongoose.model<IEmployeeMeta>('EmployeeMeta', EmployeeMetaSchema);

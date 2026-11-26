import mongoose, { Document, Schema, Types, Model } from 'mongoose';
import { columnSchemaDef, ITableColumn } from './Table';

export interface ITableRow {
  _id: Types.ObjectId;
  cells: Record<string, unknown>;
  order: number;
}

export interface ITableInstance extends Document {
  project: Types.ObjectId;
  tab?: Types.ObjectId;
  sourceTable: Types.ObjectId;
  name: string;
  periodMonth?: number;
  periodYear?: number;
  color: string;
  columns: ITableColumn[];
  rows: ITableRow[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tableInstanceSchema = new Schema<ITableInstance>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    tab: { type: Schema.Types.ObjectId, ref: 'ProjectTab' },
    sourceTable: { type: Schema.Types.ObjectId, ref: 'CustomTable', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    periodMonth: { type: Number, min: 1, max: 12 },
    periodYear: { type: Number, min: 2000, max: 2100 },
    color: { type: String, default: '#6366f1' },
    columns: [columnSchemaDef],
    rows: [
      {
        cells: { type: Schema.Types.Mixed, default: {} },
        order: { type: Number, default: 0 },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

tableInstanceSchema.index({ project: 1 });
tableInstanceSchema.index({ sourceTable: 1 });
tableInstanceSchema.index({ tab: 1 });
tableInstanceSchema.index({ tab: 1, periodYear: 1, periodMonth: 1 });

const TableInstance: Model<ITableInstance> = mongoose.model<ITableInstance>('TableInstance', tableInstanceSchema);
export default TableInstance;

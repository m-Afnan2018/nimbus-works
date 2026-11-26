import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export type ColumnType = 'text' | 'content' | 'number' | 'date' | 'time' | 'link' | 'color' | 'checkbox';

export type AutoFill = 'none' | 'serial' | 'today' | 'now';

export interface ITableColumn {
  _id: Types.ObjectId;
  key: string;
  label: string;
  type: ColumnType;
  order: number;
  autoFill: AutoFill;
  options: string[];
  width?: number;
}

export interface ICustomTable extends Document {
  name: string;
  description: string;
  color: string;
  columns: ITableColumn[];
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const COLUMN_TYPES: ColumnType[] = ['text', 'content', 'number', 'date', 'time', 'link', 'color', 'checkbox'];

export const columnSchemaDef = {
  key: { type: String, required: true },
  label: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: COLUMN_TYPES, default: 'text' },
  order: { type: Number, default: 0 },
  autoFill: { type: String, enum: ['none', 'serial', 'today', 'now'], default: 'none' },
  options: [{ type: String, trim: true, maxlength: 100 }],
  width: { type: Number, min: 60, max: 800 },
};

const tableSchema = new Schema<ICustomTable>(
  {
    name: { type: String, required: [true, 'Table name is required.'], trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: '' },
    color: { type: String, default: '#6366f1' },
    columns: [columnSchemaDef],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

const CustomTable: Model<ICustomTable> = mongoose.model<ICustomTable>('CustomTable', tableSchema);
export default CustomTable;

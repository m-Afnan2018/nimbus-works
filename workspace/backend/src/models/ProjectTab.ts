import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IProjectTab extends Document {
  project: Types.ObjectId;
  name: string;
  order: number;
  defaultTemplate?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectTabSchema = new Schema<IProjectTab>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: [true, 'Tab name is required.'], trim: true, maxlength: 120 },
    order: { type: Number, default: 0 },
    defaultTemplate: { type: Schema.Types.ObjectId, ref: 'CustomTable' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

projectTabSchema.index({ project: 1 });

const ProjectTab: Model<IProjectTab> = mongoose.model<IProjectTab>('ProjectTab', projectTabSchema);
export default ProjectTab;

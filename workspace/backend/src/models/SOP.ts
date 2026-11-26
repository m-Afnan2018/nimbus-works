import mongoose, { Document, Schema, Types, Model } from "mongoose";

export interface ISOPStep {
    _id: Types.ObjectId;
    order: number;
    title: string;
    description?: string;
    department: Types.ObjectId;
    taskTemplateId?: Types.ObjectId;
    typeId?: Types.ObjectId;
    estimatedHours?: number;
    dependsOn: number[];
    positionX?: number;
    positionY?: number;
}

export interface ISOP extends Document {
    title: string;
    description: string;
    steps: ISOPStep[];
    status: "draft" | "published";
    createdBy: Types.ObjectId;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

const sopStepSchema = new Schema<ISOPStep>(
    {
        order: { type: Number, required: true },
        title: {
            type: String,
            required: [true, "Step title is required."],
            trim: true,
            maxlength: 200,
        },
        description: { type: String, trim: true, default: "" },
        department: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: [true, "Step department is required."],
        },
        taskTemplateId: { type: Schema.Types.ObjectId },
        typeId: { type: Schema.Types.ObjectId },
        estimatedHours: { type: Number, min: 0 },
        dependsOn: [{ type: Number }],
        positionX: { type: Number },
        positionY: { type: Number },
    },
    { _id: true },
);

const sopSchema = new Schema<ISOP>(
    {
        title: {
            type: String,
            required: [true, "SOP title is required."],
            trim: true,
            maxlength: 200,
        },
        description: { type: String, trim: true, default: "" },
        steps: [sopStepSchema],
        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft",
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        version: { type: Number, default: 1 },
    },
    { collection: "sops", timestamps: true },
);

const SOP: Model<ISOP> = mongoose.model<ISOP>("SOP", sopSchema);
export default SOP;

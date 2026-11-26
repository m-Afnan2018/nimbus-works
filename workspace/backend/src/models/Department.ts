import mongoose, { Document, Schema, Types, Model } from "mongoose";

export interface ITaskType {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "critical";
    estimatedHours?: number;
    checklist: string[];
}

export interface ITaskTemplate {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "critical";
    estimatedHours?: number;
    checklist: string[];
    types: ITaskType[];
}

export interface IDepartment extends Document {
    name: string;
    description: string;
    color: string;
    heads: Types.ObjectId[];
    members: Types.ObjectId[];
    collaborators: Types.ObjectId[];
    canSocialMedia: boolean;
    taskTemplates: ITaskTemplate[];
    createdAt: Date;
    updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
    {
        name: {
            type: String,
            required: [true, "Department name is required."],
            trim: true,
            unique: true,
            maxlength: 100,
        },
        description: { type: String, trim: true, default: "" },
        color: { type: String, default: "#6366f1" },
        heads: [{ type: Schema.Types.ObjectId, ref: "User" }],
        members: [{ type: Schema.Types.ObjectId, ref: "User" }],
        collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],
        canSocialMedia: { type: Boolean, default: false },
        taskTemplates: [
            {
                title: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: 200,
                },
                description: { type: String, trim: true, default: "" },
                priority: {
                    type: String,
                    enum: ["low", "medium", "high", "critical"],
                    default: "medium",
                },
                estimatedHours: { type: Number, min: 0 },
                checklist: [{ type: String, trim: true, maxlength: 300 }],
                types: [
                    {
                        title: { type: String, required: true, trim: true, maxlength: 200 },
                        description: { type: String, trim: true, default: "" },
                        priority: {
                            type: String,
                            enum: ["low", "medium", "high", "critical"],
                            default: "medium",
                        },
                        estimatedHours: { type: Number, min: 0 },
                        checklist: [{ type: String, trim: true, maxlength: 300 }],
                    },
                ],
            },
        ],
    },
    { timestamps: true },
);

const Department: Model<IDepartment> = mongoose.model<IDepartment>(
    "Department",
    departmentSchema,
);
export default Department;

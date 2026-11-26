import mongoose, { Document, Schema, Model, Types } from "mongoose";

export interface IAttachment {
    name: string;
    url: string;
    type: "file" | "image" | "link";
    uploadedAt: Date;
}

export interface IContribution {
    user: Types.ObjectId;
    content: string;
    attachments: IAttachment[];
    links: string[];
    submittedAt: Date;
    updatedAt: Date;
    timerStatus: 'idle' | 'running' | 'paused' | 'finished';
    timerEvents: ITimerEvent[];
    totalElapsedSeconds: number;
    isDone: boolean;
}

export interface ITimerEvent {
    action: "start" | "pause" | "resume" | "hold" | "finish";
    timestamp: Date;
}

export interface IDelegation {
    delegatedBy: Types.ObjectId;
    delegatedTo: Types.ObjectId;
    note?: string;
    delegatedAt: Date;
}

export interface IDeptRequest {
    toDepartment: Types.ObjectId;
    description: string;
    checklist: string[];
    status: 'pending' | 'fulfilled';
    createdBy: Types.ObjectId;
    createdTask?: Types.ObjectId;
    createdAt: Date;
    fulfilledAt?: Date;
}

export interface IUnassignedNotice {
    user: Types.ObjectId;
    reason: 'user_deactivated';
    at: Date;
}

export interface IChecklistItem {
    title: string;
    completed: boolean;
}

export interface ITask extends Document {
    title: string;
    description?: string;
    remark?: string;
    project?: Types.ObjectId;
    department?: Types.ObjectId;
    isPersonal: boolean;
    status: "backlog" | "todo" | "in_progress" | "in_review" | "done";
    priority: "low" | "medium" | "high" | "critical";
    assignees: Types.ObjectId[];
    reporter: Types.ObjectId;
    dueDate?: Date;
    dueTime?: string;
    estimatedHours?: number;
    tags: string[];
    sopRunId?: string;
    sopRunTitle?: string;
    dependencies: Types.ObjectId[];
    attachments: IAttachment[];
    thumbnail?: string;
    notes?: string;
    links: string[];
    order: number;
    timerStatus: "idle" | "running" | "paused" | "on_hold" | "finished";
    timerEvents: ITimerEvent[];
    totalElapsedSeconds: number;
    delegations: IDelegation[];
    isGroupTask: boolean;
    contributions: IContribution[];
    requests: IDeptRequest[];
    unassignedNotices: IUnassignedNotice[];
    checklist: IChecklistItem[];
    createdAt: Date;
    updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: 300,
        },
        description: {
            type: String,
            default: "",
            maxlength: 5000,
        },
        remark: {
            type: String,
            default: "",
            maxlength: 2000,
        },
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
        },
        department: {
            type: Schema.Types.ObjectId,
            ref: "Department",
        },
        isPersonal: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["backlog", "todo", "in_progress", "in_review", "done"],
            default: "backlog",
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
            default: "medium",
        },
        assignees: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        reporter: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        dueDate: {
            type: Date,
        },
        dueTime: {
            type: String,
        },
        estimatedHours: {
            type: Number,
        },
        tags: [{ type: String, trim: true }],
        sopRunId: { type: String },
        sopRunTitle: { type: String, trim: true, maxlength: 200 },
        dependencies: [
            {
                type: Schema.Types.ObjectId,
                ref: "Task",
            },
        ],
        attachments: [
            {
                name: String,
                url: String,
                type: {
                    type: String,
                    enum: ["file", "image", "link"],
                    default: "file",
                },
                uploadedAt: { type: Date, default: Date.now },
            },
        ],
        thumbnail: { type: String, default: "" },
        notes: { type: String, default: "" },
        links: [{ type: String }],
        order: { type: Number, default: 0 },
        timerStatus: {
            type: String,
            enum: ["idle", "running", "paused", "on_hold", "finished"],
            default: "idle",
        },
        timerEvents: [
            {
                action: {
                    type: String,
                    enum: ["start", "pause", "resume", "hold", "finish"],
                    required: true,
                },
                timestamp: { type: Date, required: true },
            },
        ],
        totalElapsedSeconds: { type: Number, default: 0 },
        delegations: [
            {
                delegatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
                delegatedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
                note:        { type: String, default: "" },
                delegatedAt: { type: Date, default: Date.now },
            },
        ],
        isGroupTask: { type: Boolean, default: false },
        requests: [
            {
                toDepartment: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
                description:  { type: String, required: true, maxlength: 1000 },
                checklist:    [{ type: String, trim: true, maxlength: 300 }],
                status:       { type: String, enum: ['pending', 'fulfilled'], default: 'pending' },
                createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
                createdTask:  { type: Schema.Types.ObjectId, ref: 'Task' },
                createdAt:    { type: Date, default: Date.now },
                fulfilledAt:  { type: Date },
            },
        ],
        contributions: [
            {
                user:    { type: Schema.Types.ObjectId, ref: "User", required: true },
                content: { type: String, default: "" },
                attachments: [
                    {
                        name:       String,
                        url:        String,
                        type:       { type: String, enum: ["file", "image", "link"], default: "file" },
                        uploadedAt: { type: Date, default: Date.now },
                    },
                ],
                links:       [{ type: String }],
                submittedAt: { type: Date, default: Date.now },
                updatedAt:   { type: Date, default: Date.now },
                timerStatus: {
                    type: String,
                    enum: ['idle', 'running', 'paused', 'finished'],
                    default: 'idle',
                },
                timerEvents: [
                    {
                        action: {
                            type: String,
                            enum: ['start', 'pause', 'resume', 'finish'],
                            required: true,
                        },
                        timestamp: { type: Date, required: true },
                    },
                ],
                totalElapsedSeconds: { type: Number, default: 0 },
                isDone: { type: Boolean, default: false },
            },
        ],
        unassignedNotices: [
            {
                user:   { type: Schema.Types.ObjectId, ref: "User", required: true },
                reason: { type: String, enum: ["user_deactivated"], required: true },
                at:     { type: Date, default: Date.now },
            },
        ],
        checklist: [
            {
                title:     { type: String, required: true, trim: true, maxlength: 300 },
                completed: { type: Boolean, default: false },
            },
        ],
    },
    { timestamps: true },
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, sopRunId: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ reporter: 1 });
taskSchema.index({ isPersonal: 1 });

const Task: Model<ITask> = mongoose.model<ITask>("Task", taskSchema);
export default Task;

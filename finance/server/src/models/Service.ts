import mongoose, { Document, Schema } from "mongoose";

export interface IService extends Document {
    workspaceId: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    parentId: mongoose.Types.ObjectId | null;
    icon: string;
    color: string;
    order: number;
    clientPrice?: number;
    employeePrice?: number;
    sopId?: mongoose.Types.ObjectId | null;
}

const ServiceSchema = new Schema<IService>(
    {
        workspaceId: { type: Schema.Types.ObjectId, required: true, unique: true },
        name: { type: String, required: true },
        slug: { type: String, default: '' },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: "Service",
            default: null,
        },
        icon: { type: String, default: "ti-briefcase" },
        color: { type: String, default: "indigo" },
        order: { type: Number, default: 0 },
        clientPrice: { type: Number },
        employeePrice: { type: Number },
        // Not `ref`'d — WorkspaceSOP lives on sharedConn, a separate Mongoose
        // connection object, so cross-connection populate() can't resolve it.
        // Look it up manually via WorkspaceSOP.findById(sopId) instead.
        sopId: { type: Schema.Types.ObjectId, default: null },
    },
    { timestamps: true },
);

export default mongoose.model<IService>("Service", ServiceSchema);

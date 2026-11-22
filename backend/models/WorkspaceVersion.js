
import mongoose from "mongoose";

const workspaceVersionSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
            index: true
        },

        versionNumber: {
            type: Number,
            required: true
        },

        savedBy: {
            type: String,
            required: true
        },

        code: {
            type: String,
            required: true
        },

        language: {
            type: String,
            default: "java"
        },

        message: {
            type: String,
            trim: true,
            maxlength: 200
        }
    },
    {
        timestamps: true
    }
);

// Each version number must be unique within its workspace.
workspaceVersionSchema.index(
    { workspaceId: 1, versionNumber: 1 },
    { unique: true }
);

const WorkspaceVersion = mongoose.model(
    "WorkspaceVersion",
    workspaceVersionSchema
);

export default WorkspaceVersion;

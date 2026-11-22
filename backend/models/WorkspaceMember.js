
import mongoose from "mongoose";

const workspaceMemberSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
            required: true
        },

        userId: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["owner", "editor", "viewer"],
            default: "editor"
        },

        joinedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Prevent the same user from joining the same workspace twice.
workspaceMemberSchema.index(
    { workspaceId: 1, userId: 1 },
    { unique: true }
);

const WorkspaceMember = mongoose.model(
    "WorkspaceMember",
    workspaceMemberSchema
);

export default WorkspaceMember;

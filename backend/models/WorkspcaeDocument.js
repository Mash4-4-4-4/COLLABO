
import mongoose from "mongoose";

const workspaceDocumentSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
            unique: true
        },

        preview: {
            type: String,
            maxlength: 240,
            default: ""
        },

        // Base64 encoded Yjs document state
        yjsState: {
            type: String,
            required: true
        },

        lastSavedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

const WorkspaceDocument = mongoose.model(
    "WorkspaceDocument",
    workspaceDocumentSchema
);

export default WorkspaceDocument;

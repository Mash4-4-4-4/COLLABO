
import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        ownerId: {
            type: String,
            required: true,
            index: true
        },

        language: {
            type: String,
            default: "java",
            enum: ["java"]
        },

        visibility: {
            type: String,
            enum: ["private", "public"],
            default: "private"
        },

        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;

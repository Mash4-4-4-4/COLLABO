
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            unique: true
        },

        avatar: {
            type: String,
            default: ""
        },

        passwordHash: {
            type: String,
            default: null
        },

        authProvider: {
            type: String,
            enum: ["local", "google", "github"],
            default: "local"
        },

        authProviderId: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);


const User = mongoose.model("User", userSchema);

export default User;


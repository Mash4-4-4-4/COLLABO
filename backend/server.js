
import express from "express";
import connectDB from "./config/db.js";
import "dotenv/config"
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import * as Y from "yjs";
import executionRoutes from "./routes/executionRoutes.js"
import workspaceRoutes from "./routes/workspaceRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import { verifyToken } from "./config/auth.js"
import User from "./models/User.js"
import Workspace from "./models/Workspace.js"
import WorkspaceMember from "./models/WorkspaceMember.js"
import mongoose from "mongoose"
import { getWorkspaceDoc, installWorkspaceRuntime, applyWorkspaceUpdate, closeWorkspaceRuntime, isWorkspaceId } from "./services/workspaceRuntime.js"
const app = express();



// CORS for normal HTTP requests
app.use(cors({
    origin: "http://localhost:5173"
}));


app.use(express.json({ limit: "3mb" }));
app.use("/api/execute",executionRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/auth", authRoutes);


// Test HTTP route
app.get("/", (req, res) => {
    res.send("CODECAST Backend is running!");
});

// Create HTTP server
const httpServer = createServer(app);

// Attach Socket.IO to HTTP server
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Active members are tracked in memory; Yjs documents are hydrated from MongoDB.
const roomMembers = new Map();
const runtimeHooks = installWorkspaceRuntime(io);
app.set("mergeWorkspaceState", runtimeHooks.mergeWorkspaceState);
app.set("restoreWorkspaceCode", runtimeHooks.restoreWorkspaceCode);
app.set("notifyMemberRoleChanged", async (workspaceId, userId, role, username) => {
    const activeMembers = roomMembers.get(String(workspaceId));
    if (activeMembers) {
        for (const [socketId, member] of activeMembers.entries()) {
            if (member.userId !== String(userId)) continue;
            member.role = role;
            const activeSocket = io.sockets.sockets.get(socketId);
            if (activeSocket) activeSocket.data.role = role;
        }
    }
    io.to(String(workspaceId)).emit("member-role-updated", { userId: String(userId), username, role });
});

io.use(async (socket, next) => {
    try {
        const userId = verifyToken(socket.handshake.auth?.token);
        if (!userId) return next(new Error("Authentication required"));
        const user = await User.findById(userId).select("username email");
        if (!user) return next(new Error("Account not found"));
        socket.data.user = { id: user._id.toString(), username: user.username, email: user.email };
        next();
    } catch (error) { next(error); }
});

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);
    socket.on("join-room", async (data, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const workspaceId = typeof data?.roomId === "string" ? data.roomId.trim() : "";
        if (!isWorkspaceId(workspaceId)) return reply({ success: false, message: "Invalid workspace ID" });
        try {
            const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
            if (!workspace) return reply({ success: false, message: "Workspace not found" });
            const user = socket.data.user;
            const membership = await WorkspaceMember.findOne({ workspaceId, userId: user.id }).lean();
            const isOwner = String(workspace.ownerId) === user.id;
            if (!isOwner && !membership && workspace.visibility !== "public") return reply({ success: false, message: "You do not have access to this workspace" });
            const role = isOwner ? "owner" : membership?.role || "viewer";
            await socket.join(workspaceId);
            const members = roomMembers.get(workspaceId) || new Map();
            const member = { userId: user.id, username: user.username, role };
            members.set(socket.id, member);
            roomMembers.set(workspaceId, members);
            socket.data.roomId = workspaceId;
            socket.data.member = member;
            socket.data.role = role;
            const doc = await getWorkspaceDoc(workspaceId);
            reply({ success: true, member, members: Array.from(members.values()) });
            socket.emit("code-sync", Y.encodeStateAsUpdate(doc));
            socket.to(workspaceId).emit("user-joined", member);
        } catch (error) {
            console.error("Workspace join failed:", error);
            reply({ success: false, message: "Unable to join workspace" });
        }
    });

    socket.on("code-update", (update) => {
        const roomId = socket.data.roomId;
        if (!roomId || !["owner", "editor"].includes(socket.data.role)) return;
        try {
            const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
            if (!bytes.length || bytes.length > 1_000_000) return;
            const doc = applyWorkspaceUpdate(roomId, bytes, socket.id);
            if (doc) socket.to(roomId).emit("code-update", bytes);
        } catch (error) { console.error("Error applying code update:", error); }
    });

    socket.on("disconnect", () => {
        const roomId = socket.data.roomId;
        const member = socket.data.member;
        if (!roomId || !member) return;
        const members = roomMembers.get(roomId);
        if (!members) return;
        members.delete(socket.id);
        if (members.size === 0) roomMembers.delete(roomId);
        else io.to(roomId).emit("user-left", { userId: member.userId, username: member.username });
    });
});
// Start server
const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
        // Connect to MongoDB first
        await connectDB();

        // Start the backend only after successful connection
        httpServer.listen(5000, () => {
            console.log("CODECAST server is running on port 5000");
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

let isShuttingDown = false;
async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received; flushing workspace documents...`);
    await new Promise((resolve) => io.close(resolve));
    await closeWorkspaceRuntime();
    await mongoose.disconnect();
    process.exit(0);
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer();

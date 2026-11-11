
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import * as Y from "yjs";

const app = express();

// CORS for normal HTTP requests
app.use(cors({
    origin: "http://localhost:5173"
}));

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

// Store room members
const roomMembers = new Map();
const roomDocuments=new Map();

// Listen for connections
io.on("connection", (socket) => {

    console.log(`User Connected: ${socket.id}`);

    socket.on("join-room", async (data, acknowledge) => {

        // Safe acknowledgement function
        const reply = typeof acknowledge === "function"
            ? acknowledge
            : () => {};

        const { roomId, username } = data || {};

        // Validate room ID
        const cleanRoomId =
            typeof roomId === "string" ? roomId.trim() : "";

        // Validate username
        const cleanUsername =
            typeof username === "string" ? username.trim() : "";

        if (!cleanRoomId || !cleanUsername) {
            reply({
                success: false,
                message: "Room ID and username are required"
            });
            return;
        }

        // Generate unique member ID
        const member = {
            userId: randomUUID(),
            username: cleanUsername
        };

        // Get existing members
        const members = roomMembers.get(cleanRoomId) || new Map();

        // Join Socket.IO room
        await socket.join(cleanRoomId);
       let roomDoc=roomDocuments.get(cleanRoomId);
       if(!roomDoc)
       {
        roomDoc=new Y.Doc();

        roomDocuments.set(cleanRoomId,roomDoc);
        console.log(`cretead shared document for room ${cleanRoomId}`);

       }

        // Store member
        members.set(socket.id, member);
        roomMembers.set(cleanRoomId, members);

        // Save information on socket
        socket.data.roomId = cleanRoomId;
        socket.data.member = member;

        // Send member list to joining user
        reply({
            success: true,
            member,
            members: Array.from(members.values())
        });
// Send existing document state to the joining user
socket.emit(
    "code-sync",
    Y.encodeStateAsUpdate(roomDoc)
);
        // Notify other members
        socket.to(cleanRoomId).emit("user-joined", member);
        console.log(`${cleanUsername} joined room ${cleanRoomId}`);
    });
socket.on("code-update", (update) => {

    const roomId = socket.data.roomId;

    if (!roomId) {
        return;
    }

    const roomDoc = roomDocuments.get(roomId);

    if (!roomDoc) {
        return;
    }

    try {

        const binaryUpdate = new Uint8Array(update);

        // Apply update to server document
        Y.applyUpdate(roomDoc, binaryUpdate, socket.id);

        // Broadcast update to other room members
        socket.to(roomId).emit("code-update", binaryUpdate);

    } catch (error) {

        console.error("Error applying code update:", error);

    }

});
socket.on("disconnect", () => {

    console.log(`User Disconnected: ${socket.id}`);

    const roomId = socket.data.roomId;
    const member = socket.data.member;

    if (!roomId || !member) {
        return;
    }

    const members = roomMembers.get(roomId);

    if (!members) {
        return;
    }

    members.delete(socket.id);

    if (members.size === 0) {

        roomMembers.delete(roomId);

        // Delete empty room document
        const roomDoc = roomDocuments.get(roomId);

        if (roomDoc) {
            roomDoc.destroy();
            roomDocuments.delete(roomId);
        }

        console.log(`Deleted empty room: ${roomId}`);

    } else {

        io.to(roomId).emit("user-left", {
            userId: member.userId,
            username: member.username
        });

    }

});

});

// Start server
httpServer.listen(5000, () => {
    console.log("Server is running on port 5000");
});

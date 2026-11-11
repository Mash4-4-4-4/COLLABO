
import { io } from "socket.io-client";
import * as Y from "yjs";

const URL = "http://localhost:5000";
const ROOM_ID = "CODECAST-TEST";

// Create two clients without automatically connecting
const manishka = io(URL, { autoConnect: false });
const alex = io(URL, { autoConnect: false });

// Create a separate Yjs document for each user
const manishkaDoc = new Y.Doc();
const alexDoc = new Y.Doc();

const manishkaText = manishkaDoc.getText("monaco");
const alexText = alexDoc.getText("monaco");

let manishkaSynced = false;
let alexSynced = false;

// Connect a client
function connectSocket(socket) {
    return new Promise((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
    });
}

// Join a room
function joinRoom(socket, username) {
    return new Promise((resolve, reject) => {
        socket.emit("join-room", {
            roomId: ROOM_ID,
            username
        }, (response) => {
            if (!response?.success) {
                reject(new Error(response?.message));
                return;
            }

            console.log(`${username} joined successfully!`);
            console.log("Members:", response.members);

            resolve(response);
        });
    });
}

// Receive initial Yjs document snapshots
const manishkaSync = new Promise((resolve) => {
    manishka.on("code-sync", (update) => {
        Y.applyUpdate(manishkaDoc, new Uint8Array(update), manishka);
        manishkaSynced = true;

        console.log("Manishka received initial document sync!");
        resolve();
    });
});

const alexSync = new Promise((resolve) => {
    alex.on("code-sync", (update) => {
        Y.applyUpdate(alexDoc, new Uint8Array(update), alex);
        alexSynced = true;

        console.log("Alex received initial document sync!");
        resolve();
    });
});

// Receive code updates from other users
manishka.on("code-update", (update) => {
    Y.applyUpdate(manishkaDoc, new Uint8Array(update), manishka);
});

alex.on("code-update", (update) => {
    Y.applyUpdate(alexDoc, new Uint8Array(update), alex);
});

// Send local Yjs updates to the backend
manishkaDoc.on("update", (update, origin) => {
    if (origin !== manishka && manishkaSynced) {
        manishka.emit("code-update", update);
    }
});

alexDoc.on("update", (update, origin) => {
    if (origin !== alex && alexSynced) {
        alex.emit("code-update", update);
    }
});

async function runTest() {
    try {
        // Connect and join Manishka
        await connectSocket(manishka);
        console.log("Manishka connected:", manishka.id);

        await joinRoom(manishka, "Manishka");

        // Connect and join Alex
        await connectSocket(alex);
        console.log("\nAlex connected:", alex.id);

        await joinRoom(alex, "Alex");

        // Wait until both documents have received their snapshots
        await Promise.all([manishkaSync, alexSync]);

        console.log("\nBoth users are synchronized!");

        // Listen for Alex's document to receive Manishka's edit
        const expectedCode = 'console.log("Hello from Manishka!");';

        const alexReceivedUpdate = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                alexText.unobserve(checkUpdate);
                reject(new Error("Alex did not receive the code update."));
            }, 5000);

            function checkUpdate() {
                if (alexText.toString() === expectedCode) {
                    clearTimeout(timeout);
                    alexText.unobserve(checkUpdate);
                    resolve();
                }
            }

            alexText.observe(checkUpdate);
        });

        // Manishka edits the shared document
        console.log("\nManishka is typing code...");

        manishkaText.insert(0, expectedCode);

        // Wait for Alex to receive the update
        await alexReceivedUpdate;

        console.log("\nSUCCESS! Alex received Manishka's code!");
        console.log("Manishka's document:", manishkaText.toString());
        console.log("Alex's document:", alexText.toString());

    } catch (error) {
        console.error("\nTEST FAILED:", error.message);

    } finally {
        manishka.disconnect();
        alex.disconnect();

        manishkaDoc.destroy();
        alexDoc.destroy();
    }
}

runTest();

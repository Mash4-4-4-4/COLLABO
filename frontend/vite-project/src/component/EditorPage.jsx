
import { useEffect, useRef, useState } from "react";
import { useParams,useSearchParams } from 'react-router-dom'
import {initSocket} from "../socket"
import EditorSidebar from './EditorSidebar'
import { getRandomAvatar } from '../utils/avatarUtils'
import Toast from "./Toast"
import './EditorPage.css'
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
function EditorPage()
{
 const socketRef=useRef(null);

 // Stores the Yjs document for this editor session
const ydocRef = useRef(null);



// Stores the Monaco-Yjs binding
const bindingRef = useRef(null);

// Tracks whether the initial document synchronization is complete
const isDocumentSyncedRef = useRef(false);

// Controls whether the editor is ready for typing
const [isDocumentSynced, setIsDocumentSynced] = useState(false);

const { roomId } = useParams();
const [searchParams] = useSearchParams();
const [toastMessage, setToastMessage] = useState("");
const username = searchParams.get('username');
 const [isConnected,setIsConnected]=useState(false);

const [members, setMembers] = useState([]);
useEffect(() => {

    // 1. Create a Socket.IO connection
const socket = initSocket();
socketRef.current = socket;

// Reset document synchronization for this session
isDocumentSyncedRef.current = false;
setIsDocumentSynced(false);
// Get the Yjs document
const ydoc = new Y.Doc();
ydocRef.current = ydoc;

// Receive the initial document from the backend
const handleCodeSync = (update) => {

    console.log("Received initial Yjs document!");

    // Apply the server's document state locally
    Y.applyUpdate(ydoc, new Uint8Array(update), socket);

    // Mark synchronization as complete
    isDocumentSyncedRef.current = true;
    setIsDocumentSynced(true);

};

// Receive updates made by other users
const handleCodeUpdate = (update) => {

    console.log("Received code update from another user!");

    Y.applyUpdate(ydoc, new Uint8Array(update), socket);

};

// Send our local changes to the backend
const handleYjsUpdate = (update, origin) => {

    // Ignore updates received from the backend
    if (origin === socket) {
        return;
    }

    // Don't send changes before initial synchronization
    if (!isDocumentSyncedRef.current) {
        return;
    }

    socket.emit("code-update", update);

};
    socketRef.current = socket;

    // 2. Handle successful connection
    const handleConnect = () => {

        console.log("Connected to CODECAST server!");
        console.log("Socket ID:", socket.id);

        setIsConnected(true);

        // 3. Ask backend to join this room
        socket.emit(
            "join-room",
            {
                roomId,
                username
            },
            (response) => {

                console.log("Join room response:", response);

                if (!response?.success) {
                    console.error(response.message||"failed to join room");
                    return;
                }

                // 4. Convert backend members into sidebar members
                setMembers((previousMembers) => {

                    const updatedMembers = [];

                    response.members.forEach((serverMember) => {

                        const existingMember = previousMembers.find(
                            (member) => member.id === serverMember.userId
                        );

                        updatedMembers.push({
                            id: serverMember.userId,
                            username: serverMember.username,

                            // Preserve an existing avatar
                            // or generate a new one
                            avatar: existingMember
                                ? existingMember.avatar
                                : getRandomAvatar(updatedMembers)
                        });

                    });

                    return updatedMembers;
                });

            }
        );

    };

    // 5. Handle disconnection
    const handleDisconnect = () => {

        console.log("Disconnected from server");

        setIsConnected(false);
    };

    // 6. Handle connection errors
    const handleConnectError = (error) => {
        console.error("Connection failed:", error.message);
    };

    // 7. Listen for new members
    const handleUserJoined = (serverMember) => {

    // Show notification
    setToastMessage(`${serverMember.username} joined the room!`);

    // Add the new member to the sidebar
    setMembers((previousMembers) => {

        // Prevent duplicate members
        if (previousMembers.some(
            member => member.id === serverMember.userId
        )) {
            return previousMembers;
        }

        const newMember = {
            id: serverMember.userId,
            username: serverMember.username,
            avatar: getRandomAvatar(previousMembers)
        };

        return [...previousMembers, newMember];
    });

};

  const handleUserLeft = (serverMember) => {

    // Show departure notification
    setToastMessage(`${serverMember.username} left the room!`);

    // Remove the member from the sidebar
    setMembers((previousMembers) =>
        previousMembers.filter(
            member => member.id !== serverMember.userId
        )
    );

};

    // 9. Register listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);

    // Listen for initial document synchronization
socket.on("code-sync", handleCodeSync);
// Listen for changes made by other users
socket.on("code-update", handleCodeUpdate);
// Listen for local Yjs document changes

ydoc.on("update", handleYjsUpdate);
    // 10. Start connection
    socket.connect();

    // 11. Cleanup
return () => {
    // Remove Socket.IO listeners
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("connect_error", handleConnectError);
    socket.off("user-joined", handleUserJoined);
    socket.off("user-left", handleUserLeft);
    socket.off("code-sync", handleCodeSync);
    socket.off("code-update", handleCodeUpdate);

    // Remove Yjs update listener
    ydoc.off("update", handleYjsUpdate);

    // Destroy the Monaco-Yjs binding
    bindingRef.current?.destroy();
    bindingRef.current = null;

    // Disconnect from backend
    socket.disconnect();
    socketRef.current = null;

    // Destroy this session's Yjs document
    ydoc.destroy();
    ydocRef.current = null;

    // Reset synchronization status
    isDocumentSyncedRef.current = false;
    setIsDocumentSynced(false);
};

}, [roomId, username]);
// Connect Monaco Editor with the Yjs shared document
const handleEditorMount = (editor) => {
 
    console.log("Monaco Editor mounted!");

    // Get our existing Yjs document
    const ydoc = ydocRef.current;

    // Get the shared text object
    const yText = ydoc.getText("monaco");

    // Get Monaco's text model
    const model = editor.getModel();

    if (!model) {
        console.error("Monaco model not found!");
        return;
    }

    // Connect Monaco and Yjs
    const binding = new MonacoBinding(
        yText,
        model,
        new Set([editor])
    );

    // Store the binding for cleanup
    bindingRef.current = binding;

    console.log("Monaco is now connected to Yjs!");
};
  return (
    <div className="editor-layout">

       <Toast
            message={toastMessage}
            onClose={() => setToastMessage("")}
        />
      <EditorSidebar
        roomId={roomId}
        members={members}
      />

      <main className="editor-workspace">

        {/* TEMPORARY TEST CONTROLS */}



        {/* YOUR CODE EDITOR GOES HERE */}
        <div style={{ height: "100vh", background: "#1e1e1e" }}>
      
<Editor
    height="100%"
    defaultLanguage="javascript"
    theme="vs-dark"

    // Connect Monaco with Yjs when the editor mounts
    onMount={handleEditorMount}

    // Prevent editing until the server document arrives
    options={{
        fontSize: 15,
        minimap: { enabled: true },
        automaticLayout: true,
        readOnly: !isDocumentSynced,
    }}
/>
    </div>

      </main>

    </div>
  )
}

export default EditorPage

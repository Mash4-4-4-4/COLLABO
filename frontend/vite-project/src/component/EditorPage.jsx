import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { initSocket } from "../socket";
import EditorSidebar from "./EditorSidebar";
import { getRandomAvatar } from "../utils/avatarUtils";
import Toast from "./Toast";
import "./EditorPage.css";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import Terminal from "./Terminal";
import { api, apiUrl } from "../utils/api";

function EditorPage() {
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const syncedRef = useRef(false);
  const canEditRef = useRef(false);
  const { roomId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [synced, setSynced] = useState(false);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState([]);
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState("");
  const [liveCode, setLiveCode] = useState("");
  const [versions, setVersions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [compareVersion, setCompareVersion] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [memberActionBusy, setMemberActionBusy] = useState(false);
  const [currentUserId] = useState(() => {
    try { return JSON.parse(localStorage.getItem("codecast_user") || "{}").id || ""; }
    catch { return ""; }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [executionError, setExecutionError] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const [exitCode, setExitCode] = useState(null);
  const role = workspace?.role || "viewer";
  const canEdit = role === "owner" || role === "editor";

  useEffect(() => {
    let disposed = false;
    const socket = initSocket();
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    syncedRef.current = false;

    const onSync = (update) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), socket);
      setLiveCode(ydoc.getText("monaco").toString());
      syncedRef.current = true;
      setSynced(true);
    };
    const onUpdate = (update) => Y.applyUpdate(ydoc, new Uint8Array(update), socket);
    const onLocalUpdate = (update, origin) => {
      setLiveCode(ydoc.getText("monaco").toString());
      if (origin !== socket && syncedRef.current && canEditRef.current) socket.emit("code-update", update);
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (error) => setToast(error.message || "Could not connect");
    const onJoin = (response) => {
      if (!response?.success) {
        setToast(response?.message || "Could not join workspace");
        return;
      }
      setMembers(response.members.map((member, index) => ({
        id: member.userId,
        username: member.username,
        role: member.role,
        avatar: getRandomAvatar(index ? response.members.slice(0, index) : [])
      })));
    };
    const onJoined = (member) => {
      setMembers((list) => list.some((item) => item.id === member.userId)
        ? list
        : [...list, { id: member.userId, username: member.username, role: member.role, avatar: getRandomAvatar(list) }]);
      setToast(`${member.username} joined`);
    };
    const onRoleUpdated = (member) => {
      setMembers((list) => list.map((item) => item.id === member.userId ? { ...item, role: member.role } : item));
      setWorkspaceMembers((list) => list.map((item) => item.userId === member.userId ? { ...item, role: member.role } : item));
      if (member.userId === currentUserId) {
        const nowCanEdit = member.role === "owner" || member.role === "editor";
        canEditRef.current = nowCanEdit;
        setWorkspace((current) => current ? { ...current, role: member.role } : current);
        setToast(nowCanEdit ? "Your access changed to editor. You can edit again." : "Your access changed to viewer. Editing is disabled.");
      } else {
        setToast(`${member.username} access changed to ${member.role}`);
      }
    };    const onLeft = (member) => {
      setMembers((list) => list.filter((item) => item.id !== member.userId));
      setToast(`${member.username} left the room`);
    };

    socket.on("code-sync", onSync);
    socket.on("code-update", onUpdate);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("user-joined", onJoined);
    socket.on("user-left", onLeft);
    socket.on("member-role-updated", onRoleUpdated);
    ydoc.on("update", onLocalUpdate);

    api(`/api/workspaces/${roomId}`).then((result) => {
      if (disposed) return;
      canEditRef.current = result.workspace.role === "owner" || result.workspace.role === "editor";
      setWorkspace(result.workspace);
      socket.connect();
      socket.emit("join-room", { roomId }, onJoin);
    }).catch((error) => {
      if (!disposed) setToast(error.message);
    });

    return () => {
      disposed = true;
      socket.off("code-sync", onSync);
      socket.off("code-update", onUpdate);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("user-joined", onJoined);
      socket.off("user-left", onLeft);
      socket.off("member-role-updated", onRoleUpdated);
      ydoc.off("update", onLocalUpdate);
      bindingRef.current?.destroy();
      bindingRef.current = null;
      socket.disconnect();
      ydoc.destroy();
      ydocRef.current = null;
      syncedRef.current = false;
    };
  }, [roomId, currentUserId]);

  async function saveWorkspace() {
    const doc = ydocRef.current;
    if (!doc || !syncedRef.current || !canEdit) return false;
    setSaveState("Saving...");
    try {
      const bytes = Y.encodeStateAsUpdate(doc);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      await api(`/api/workspaces/${roomId}/document`, {
        method: "PUT",
        body: JSON.stringify({ yjsState: btoa(binary) })
      });
      setSaveState("Saved");
      setTimeout(() => setSaveState((current) => current === "Saved" ? "" : current), 2500);
      return true;
    } catch (error) {
      setSaveState("Save failed");
      setToast(error.message);
      return false;
    }
  }

  async function loadVersions() {
    try {
      const result = await api(`/api/workspaces/${roomId}/versions`);
      setVersions(result.versions || []);
    } catch (error) { setToast(error.message); }
  }
  async function openHistory() {
    setShowHistory(true);
    await loadVersions();
  }
  async function checkpoint() {
    const message = window.prompt("Name this checkpoint (optional):", "Checkpoint");
    if (message === null) return;
    try {
      if (!(await saveWorkspace())) return;
      const result = await api(`/api/workspaces/${roomId}/versions`, {
        method: "POST",
        body: JSON.stringify({ message })
      });
      setVersions((list) => [result.version, ...list]);
      setToast("Checkpoint created");
    } catch (error) { setToast(error.message); }
  }
  async function restoreVersion(version) {
    if (!window.confirm(`Restore version ${version.versionNumber}? Current code will be replaced.`)) return;
    try {
      await api(`/api/workspaces/${roomId}/versions/${version._id}/restore`, { method: "POST", body: "{}" });
      setToast(`Restored version ${version.versionNumber}`);
    } catch (error) { setToast(error.message); }
  }
  async function openMemberManager() {
    setShowMembers(true);
    try {
      const result = await api(`/api/workspaces/${roomId}/members`);
      setWorkspaceMembers(result.members || []);
    } catch (error) { setToast(error.message); }
  }

  async function inviteMember(event) {
    event.preventDefault();
    setMemberActionBusy(true);
    try {
      const result = await api(`/api/workspaces/${roomId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      setWorkspaceMembers((list) => {
        const exists = list.some((member) => member.userId === result.member.userId);
        return exists
          ? list.map((member) => member.userId === result.member.userId ? result.member : member)
          : [...list, result.member];
      });
      setInviteEmail("");
      setToast(`${result.member.username} added as ${result.member.role}`);
    } catch (error) { setToast(error.message); }
    finally { setMemberActionBusy(false); }
  }

  async function changeMemberRole(member, role) {
    setMemberActionBusy(true);
    try {
      const result = await api(`/api/workspaces/${roomId}/members/${member.userId}`, {
        method: "PUT",
        body: JSON.stringify({ role })
      });
      setWorkspaceMembers((list) => list.map((item) => item.userId === member.userId ? result.member : item));
      setToast(`${result.member.username} is now ${result.member.role}`);
    } catch (error) { setToast(error.message); }
    finally { setMemberActionBusy(false); }
  }
  async function runCode() {
    const doc = ydocRef.current;
    if (!doc || !syncedRef.current) {
      setExecutionError("Editor is not synchronized yet.");
      return;
    }
    const code = doc.getText("monaco").toString();
    if (!code.trim()) {
      setExecutionError("Please write some Java code first.");
      return;
    }
    setIsRunning(true);
    setOutput("");
    setExecutionError(null);
    setExecutionTime(null);
    setExitCode(null);
    try {
      const response = await fetch(`${apiUrl}/api/execute/java`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input: customInput })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Execution request failed");
      setOutput(result.output || "");
      setExecutionError(result.error || null);
      setExecutionTime(result.executionTime);
      setExitCode(result.exitCode);
    } catch (error) {
      setExecutionError(error.message || "Could not connect to execution server.");
    } finally { setIsRunning(false); }
  }

  function handleEditorMount(editor) {
    const doc = ydocRef.current;
    const model = editor.getModel();
    if (!doc || !model) return;
    bindingRef.current?.destroy();
    bindingRef.current = new MonacoBinding(doc.getText("monaco"), model, new Set([editor]));
  }

  return (
    <div className="editor-layout">
      <Toast message={toast} onClose={() => setToast("")} />
      <EditorSidebar
        roomId={roomId}
        workspace={workspace}
        members={members}
        saveWorkspace={saveWorkspace}
        saveState={saveState}
        canEdit={canEdit}
        onHistory={openHistory}
        onCheckpoint={checkpoint}
        onInvite={openMemberManager}
        connected={connected}
      />
      <main className="editor-workspace">
        <div className="editor-toolbar">
          <span className="editor-language">JAVA | {role.toUpperCase()}</span>
          <span className="editor-save-status">{connected ? "CONNECTED" : "OFFLINE"} {saveState}</span>
          <button className="run-button" onClick={runCode} disabled={!synced || isRunning || !canEdit}>
            {isRunning ? "RUNNING..." : "RUN"}
          </button>
        </div>
        <div className="editor-container">
          <Editor
            height="100%"
            defaultLanguage="java"
            theme="vs-dark"
            onMount={handleEditorMount}
            options={{ fontSize: 15, minimap: { enabled: true }, automaticLayout: true, readOnly: !synced || !canEdit }}
          />
        </div>
        <div className="input-container">
          <label htmlFor="custom-input">CUSTOM INPUT (STDIN)</label>
          <textarea
            id="custom-input"
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            placeholder="Enter input for your Java program..."
            disabled={isRunning || !canEdit}
          />
        </div>
        <Terminal output={output} error={executionError} isRunning={isRunning} executionTime={executionTime} exitCode={exitCode} />
      </main>

      {showMembers && (
        <div className="history-backdrop" role="presentation" onClick={() => setShowMembers(false)}>
          <section className="history-panel members-panel" role="dialog" aria-modal="true" aria-label="Manage collaborators" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>Manage collaborators</h2>
              <button onClick={() => setShowMembers(false)}>Close</button>
            </header>
            <p className="members-help">Invite a registered CODECAST account by email. Viewers can read code but cannot edit or save.</p>
            <form className="member-invite-form" onSubmit={inviteMember}>
              <label htmlFor="invite-email">Email address</label>
              <input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" required />
              <label htmlFor="invite-role">Access</label>
              <select id="invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" disabled={memberActionBusy}>{memberActionBusy ? "SAVING..." : "INVITE COLLABORATOR"}</button>
            </form>
            <h3>Workspace members</h3>
            {workspaceMembers.map((member) => (
              <article className="workspace-member-row" key={member.userId}>
                <div><strong>{member.username}</strong><span>{member.email || "Account unavailable"}</span></div>
                {member.role === "owner" ? <span className="workspace-member-owner">OWNER</span> : (
                  <select aria-label={`Access for ${member.username}`} value={member.role} disabled={memberActionBusy} onChange={(event) => changeMemberRole(member, event.target.value)}>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                )}
              </article>
            ))}
          </section>
        </div>
      )}      {showHistory && (
        <div className="history-backdrop" role="presentation" onClick={() => setShowHistory(false)}>
          <section className="history-panel" role="dialog" aria-modal="true" aria-label="Code history" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>Code history</h2>
              <button onClick={() => setShowHistory(false)} aria-label="Close history">Close</button>
            </header>
            {versions.length === 0 ? <p>No checkpoints yet.</p> : versions.map((version) => (
              <article className="version-card" key={version._id}>
                <strong>Version {version.versionNumber}</strong>
                <span>{version.message || "Checkpoint"} | {new Date(version.createdAt).toLocaleString()}</span>
                <span>by {version.author || "User"}</span>
                <div>
                  <button onClick={() => setCompareVersion(version)}>Compare</button>
                  {canEdit && <button onClick={() => restoreVersion(version)}>Restore</button>}
                </div>
              </article>
            ))}
            {compareVersion && (
              <div className="version-compare">
                <h3>Version {compareVersion.versionNumber} comparison</h3>
                <div className="compare-columns">
                  <div><h4>Saved version</h4><pre>{compareVersion.code}</pre></div>
                  <div><h4>Current document</h4><pre>{liveCode}</pre></div>
                </div>
                <button onClick={() => setCompareVersion(null)}>Close comparison</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default EditorPage;

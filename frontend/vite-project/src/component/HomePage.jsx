import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PixelButton from "./PixelButton";
import Toast from "./Toast";
import { api } from "../utils/api";
import "./HomePage.css";

function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("codecast_user") || "null"); }
    catch { return null; }
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadWorkspaces() {
    const result = await api("/api/workspaces");
    setWorkspaces(result.workspaces || []);
  }

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    api("/api/workspaces")
      .then((result) => { if (!cancelled) setWorkspaces(result.workspaces || []); })
      .catch((loadError) => { if (!cancelled) setError(loadError.message); });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });
      localStorage.setItem("codecast_token", result.token);
      localStorage.setItem("codecast_user", JSON.stringify(result.user));
      setUser(result.user);
      setPassword("");
    } catch (authError) { setError(authError.message); }
    finally { setBusy(false); }
  }

  async function createWorkspace(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || "Untitled Workspace" })
      });
      navigate(`/editor/${result.workspace._id}`);
    } catch (createError) { setError(createError.message); }
    finally { setBusy(false); }
  }

  async function joinWorkspace(event) {
    event.preventDefault();
    const workspaceId = joinId.trim();
    if (!workspaceId) { setError("Enter a workspace ID"); return; }
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${encodeURIComponent(workspaceId)}/join`, {
        method: "POST",
        body: "{}"
      });
      navigate(`/editor/${encodeURIComponent(result.workspaceId)}`);
    } catch (joinError) {
      setError(joinError.message === "Workspace not found"
        ? "Check the workspace ID and ask its owner for an invitation."
        : joinError.message);
    } finally { setBusy(false); }
  }

  async function renameWorkspace(workspace) {
    const nextName = window.prompt("Workspace name", workspace.name)?.trim();
    if (!nextName || nextName === workspace.name) return;
    try {
      await api(`/api/workspaces/${workspace._id}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) });
      await loadWorkspaces();
    } catch (renameError) { setError(renameError.message); }
  }

  async function deleteWorkspace(workspace) {
    if (!window.confirm(`Delete "${workspace.name}"?`)) return;
    try {
      await api(`/api/workspaces/${workspace._id}`, { method: "DELETE" });
      await loadWorkspaces();
    } catch (deleteError) { setError(deleteError.message); }
  }

  function signOut() {
    localStorage.removeItem("codecast_token");
    localStorage.removeItem("codecast_user");
    setUser(null);
    setWorkspaces([]);
  }

  const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : "Recently";

  if (!user) {
    return (
      <main className="codecast-page">
        <section className="codecast-card">
          <div className="codecast-brand"><span>CODECAST</span></div>
          <div className="codecast-heading">
            <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
            <p className="codecast-subtitle">Sign in to find your workspaces and code together.</p>
          </div>
          <form className="codecast-form" onSubmit={submitAuth}>
            {isRegister && <input className="codecast-input" placeholder="USERNAME" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} required />}
            <input className="codecast-input" type="email" placeholder="EMAIL" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <input className="codecast-input" type="password" placeholder="PASSWORD (8+ CHARACTERS)" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            <Toast message={error} onClose={() => setError("")} />
            <PixelButton className="auth-submit-button" type="submit" disabled={busy}>
              {busy ? "PLEASE WAIT..." : isRegister ? "CREATE ACCOUNT" : "SIGN IN"}
            </PixelButton>
          </form>
          <div className="codecast-create">
            <span>{isRegister ? "Already have an account?" : "New to CODECAST?"}</span>
            <button className="auth-switch-button" type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }}>
              {isRegister ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="codecast-page dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div className="codecast-brand"><span>CODECAST</span></div>
          <div className="dashboard-user">
            <span>{user.username} | {user.email}</span>
            <button className="dashboard-signout-button" onClick={signOut}>SIGN OUT</button>
          </div>
        </header>
        <div className="dashboard-title-row">
          <div><h1>My Workspaces</h1><p>Pick up where you left off or start something new.</p></div>
        </div>
        <Toast message={error} onClose={() => setError("")} />
        <section className="workspace-grid">
          {workspaces.map((workspace) => (
            <article className="workspace-card" key={workspace._id}>
              <Link className="workspace-open" to={`/editor/${workspace._id}`}>
                <strong>{workspace.name}</strong>
                <span className="workspace-language">Java</span>
                <pre className="workspace-code-preview">{workspace.codePreview || "No code preview available."}</pre>
                <span className="workspace-updated">Updated {dateLabel(workspace.updatedAt)}</span>
                <span className="workspace-role">{workspace.role}</span>
              </Link>
              {workspace.role === "owner" && (
                <div className="workspace-card-actions">
                  <button onClick={() => renameWorkspace(workspace)}>Rename</button>
                  <button onClick={() => deleteWorkspace(workspace)}>Delete</button>
                </div>
              )}
            </article>
          ))}
          <form className="workspace-card join-workspace-card" onSubmit={joinWorkspace}>
            <strong>Join Workspace</strong>
            <span>Open a workspace by ID</span>
            <input aria-label="Workspace ID" className="codecast-input" placeholder="Paste workspace ID" value={joinId} onChange={(event) => setJoinId(event.target.value)} />
            <small>The workspace ID lets you join as a collaborator.</small>
            <PixelButton className="dashboard-join-submit" type="submit" disabled={busy}>
              {busy ? "OPENING..." : "JOIN WORKSPACE"}
            </PixelButton>
          </form>
          <form className="workspace-card create-workspace-card" onSubmit={createWorkspace}>
            <strong>Create Workspace</strong>
            <span>Start a new project</span>
            <input aria-label="New workspace name" className="codecast-input" placeholder="Workspace name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
            <PixelButton className="auth-submit-button" type="submit" disabled={busy}>
              {busy ? "CREATING..." : "CREATE WORKSPACE"}
            </PixelButton>
          </form>
        </section>
      </section>
    </main>
  );
}

export default HomePage;

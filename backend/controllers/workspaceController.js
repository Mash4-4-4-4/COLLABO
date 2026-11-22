import * as Y from "yjs";
import Workspace from "../models/Workspace.js";
import WorkspaceDocument from "../models/WorkspcaeDocument.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import WorkspaceVersion from "../models/WorkspaceVersion.js";
import User from "../models/User.js";
import { isWorkspaceId } from "../services/workspaceRuntime.js";

const STARTER_CODE = `public class Main {
    public static void main(String[] args) {

        // Write your Java code here

    }
}`;
const fail = (res, status, message) => res.status(status).json({ message });

async function access(workspaceId, userId, minimum = "viewer") {
    if (!isWorkspaceId(workspaceId)) return null;
    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
    if (!workspace) return null;
    const membership = await WorkspaceMember.findOne({ workspaceId, userId: String(userId) });
    if (String(workspace.ownerId) === String(userId)) return { workspace, role: "owner" };
    if (membership) return { workspace, role: membership.role };
    if (workspace.visibility === "public" && minimum === "viewer") return { workspace, role: "viewer" };
    return null;
}
const canEdit = (role) => role === "owner" || role === "editor";

export async function createWorkspace(req, res) {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const visibility = req.body?.visibility ?? "private";
    const language = req.body?.language ?? "java";
    if (!name || name.length > 100) return fail(res, 400, "Workspace name must be between 1 and 100 characters");
    if (language !== "java" || !["private", "public"].includes(visibility)) return fail(res, 400, "Invalid workspace settings");

    const ydoc = new Y.Doc();
    let workspace;
    try {
        ydoc.getText("monaco").insert(0, STARTER_CODE);
        workspace = await Workspace.create({ name, ownerId: req.user._id.toString(), language, visibility });
        const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64");
        await WorkspaceDocument.create({ workspaceId: workspace._id, yjsState, preview: STARTER_CODE.slice(0, 240) });
        await WorkspaceMember.create({ workspaceId: workspace._id, userId: req.user._id.toString(), role: "owner" });
        return res.status(201).json({ workspace, document: { yjsState } });
    } catch (error) {
        if (workspace) await Promise.allSettled([
            WorkspaceDocument.deleteOne({ workspaceId: workspace._id }),
            WorkspaceMember.deleteMany({ workspaceId: workspace._id }),
            Workspace.deleteOne({ _id: workspace._id })
        ]);
        console.error("Workspace creation failed:", error);
        return fail(res, 500, "Unable to create workspace");
    } finally { ydoc.destroy(); }
}

export async function listWorkspaces(req, res) {
    const userId = req.user._id.toString();
    const memberships = await WorkspaceMember.find({ userId }).select("workspaceId role").lean();
    const ids = memberships.map((item) => item.workspaceId);
    const workspaces = await Workspace.find({ isDeleted: false, $or: [{ ownerId: userId }, { _id: { $in: ids } }] }).sort({ updatedAt: -1 }).lean();
    const documents = await WorkspaceDocument.find({ workspaceId: { $in: workspaces.map((workspace) => workspace._id) } }).select("workspaceId preview yjsState").lean();
    const previews = new Map();
    for (const document of documents) {
        let preview = document.preview || "";
        if (!preview && document.yjsState) {
            const ydoc = new Y.Doc();
            try {
                Y.applyUpdate(ydoc, new Uint8Array(Buffer.from(document.yjsState, "base64")));
                preview = ydoc.getText("monaco").toString();
            } catch (error) { console.error("Workspace preview could not be decoded:", error); }
            finally { ydoc.destroy(); }
        }
        previews.set(String(document.workspaceId), preview.slice(0, 240));
    }
    const roles = new Map(memberships.map((item) => [String(item.workspaceId), item.role]));
    return res.json({ workspaces: workspaces.map((workspace) => ({
        ...workspace,
        role: String(workspace.ownerId) === userId ? "owner" : roles.get(String(workspace._id)),
        codePreview: previews.get(String(workspace._id)) || ""
    })) });
}
export async function joinWorkspace(req, res) {
    if (!isWorkspaceId(req.params.id)) return fail(res, 404, "Workspace not found");
    const workspace = await Workspace.findOne({ _id: req.params.id, isDeleted: false });
    if (!workspace) return fail(res, 404, "Workspace not found");
    const userId = req.user._id.toString();
    if (String(workspace.ownerId) === userId) return res.json({ workspaceId: String(workspace._id), role: "owner" });

    const role = workspace.visibility === "public" ? "viewer" : "editor";
    const member = await WorkspaceMember.findOneAndUpdate(
        { workspaceId: workspace._id, userId },
        { $setOnInsert: { role, joinedAt: new Date() } },
        { upsert: true, returnDocument: "after", runValidators: true }
    );
    return res.json({ workspaceId: String(workspace._id), role: member.role });
}
export async function getWorkspace(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result) return fail(res, 404, "Workspace not found");
    const document = await WorkspaceDocument.findOne({ workspaceId: result.workspace._id }).lean();
    return res.json({ workspace: { ...result.workspace.toObject(), role: result.role }, document: document ? { yjsState: document.yjsState, lastSavedAt: document.lastSavedAt } : null });
}

export async function renameWorkspace(req, res) {
    const result = await access(req.params.id, req.user._id, "owner");
    if (!result || result.role !== "owner") return fail(res, 404, "Workspace not found");
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 100) return fail(res, 400, "Workspace name must be between 1 and 100 characters");
    result.workspace.name = name;
    await result.workspace.save();
    return res.json({ workspace: result.workspace });
}

export async function deleteWorkspace(req, res) {
    const result = await access(req.params.id, req.user._id, "owner");
    if (!result || result.role !== "owner") return fail(res, 404, "Workspace not found");
    result.workspace.isDeleted = true;
    await result.workspace.save();
    return res.json({ success: true });
}

export async function saveWorkspace(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result) return fail(res, 404, "Workspace not found");
    if (!canEdit(result.role)) return fail(res, 403, "You have view-only access");
    const encoded = req.body?.yjsState;
    if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > 2_000_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
        return fail(res, 400, "A valid Yjs state is required");
    }
    const doc = new Y.Doc();
    try {
        const update = Buffer.from(encoded, "base64");
        Y.applyUpdate(doc, new Uint8Array(update));
        const merged = await req.app.get("mergeWorkspaceState")(req.params.id, new Uint8Array(update));
        const yjsState = Buffer.from(merged).toString("base64");
        const saved = await WorkspaceDocument.findOneAndUpdate({ workspaceId: req.params.id }, { $set: { yjsState, preview: doc.getText("monaco").toString().slice(0, 240), lastSavedAt: new Date() } }, { upsert: true, returnDocument: "after", runValidators: true });
        result.workspace.updatedAt = new Date();
        await result.workspace.save();
        return res.json({ success: true, savedAt: saved.lastSavedAt });
    } catch (error) {
        console.error("Workspace save failed:", error);
        return fail(res, 500, "Could not save workspace state");
    } finally { doc.destroy(); }
}
export async function listMembers(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result || result.role !== "owner") return fail(res, 404, "Workspace not found");
    const memberships = await WorkspaceMember.find({ workspaceId: result.workspace._id }).lean();
    const users = await User.find({ _id: { $in: memberships.map((member) => member.userId) } }).select("username email").lean();
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    return res.json({ members: memberships.map((member) => {
        const user = userMap.get(String(member.userId));
        return { userId: String(member.userId), username: user?.username || "Unknown user", email: user?.email || "", role: member.role };
    }) });
}

export async function updateMemberRole(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result || result.role !== "owner") return fail(res, 404, "Workspace not found");
    const { userId } = req.params;
    const role = req.body?.role;
    if (!isWorkspaceId(userId) || !["editor", "viewer"].includes(role)) return fail(res, 400, "Choose editor or viewer access");
    const member = await WorkspaceMember.findOneAndUpdate(
        { workspaceId: result.workspace._id, userId },
        { $set: { role } },
        { returnDocument: "after", runValidators: true }
    );
    if (!member) return fail(res, 404, "Workspace member not found");
    const user = await User.findById(userId).select("username email").lean();
    await req.app.get("notifyMemberRoleChanged")?.(String(result.workspace._id), userId, role, user?.username || "Member");
    return res.json({ member: { userId, username: user?.username || "Unknown user", email: user?.email || "", role: member.role } });
}
export async function inviteMember(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result || result.role !== "owner") return fail(res, 404, "Workspace not found");
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const role = req.body?.role;
    if (!email || !["editor", "viewer"].includes(role)) return fail(res, 400, "A valid email and editor or viewer role are required");
    const user = await User.findOne({ email });
    if (!user) return fail(res, 404, "Create an account for this user before inviting them");
    if (String(user._id) === String(req.user._id)) return fail(res, 400, "You already own this workspace");
    const member = await WorkspaceMember.findOneAndUpdate({ workspaceId: result.workspace._id, userId: String(user._id) }, { $set: { role } }, { upsert: true, returnDocument: "after", runValidators: true });
    await req.app.get("notifyMemberRoleChanged")?.(String(result.workspace._id), String(user._id), member.role, user.username);
    return res.status(200).json({ member: { userId: String(user._id), username: user.username, email: user.email, role: member.role } });
}

export async function listVersions(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result) return fail(res, 404, "Workspace not found");
    const versions = await WorkspaceVersion.find({ workspaceId: result.workspace._id }).sort({ versionNumber: -1 }).lean();
    const authors = await User.find({ _id: { $in: versions.map((version) => version.savedBy) } }).select("username").lean();
    const names = new Map(authors.map((author) => [String(author._id), author.username]));
    return res.json({ versions: versions.map((version) => ({ ...version, author: names.get(String(version.savedBy)) || "Former user" })) });
}

export async function createVersion(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result) return fail(res, 404, "Workspace not found");
    if (!canEdit(result.role)) return fail(res, 403, "You have view-only access");
    const state = await WorkspaceDocument.findOne({ workspaceId: result.workspace._id }).lean();
    if (!state) return fail(res, 404, "Workspace document not found");
    const doc = new Y.Doc();
    try {
        Y.applyUpdate(doc, new Uint8Array(Buffer.from(state.yjsState, "base64")));
        const code = doc.getText("monaco").toString();
        const last = await WorkspaceVersion.findOne({ workspaceId: result.workspace._id }).sort({ versionNumber: -1 }).select("versionNumber").lean();
        const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 200) : "";
        const version = await WorkspaceVersion.create({ workspaceId: result.workspace._id, versionNumber: (last?.versionNumber || 0) + 1, savedBy: req.user._id.toString(), code, language: result.workspace.language, message });
        return res.status(201).json({ version });
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, "Another checkpoint was created; please try again");
        throw error;
    } finally { doc.destroy(); }
}

export async function restoreVersion(req, res) {
    const result = await access(req.params.id, req.user._id);
    if (!result) return fail(res, 404, "Workspace not found");
    if (!canEdit(result.role)) return fail(res, 403, "You have view-only access");
    const version = await WorkspaceVersion.findOne({ _id: req.params.versionId, workspaceId: result.workspace._id });
    if (!version) return fail(res, 404, "Version not found");
    const state = await req.app.get("restoreWorkspaceCode")(req.params.id, version.code);
    await WorkspaceDocument.findOneAndUpdate({ workspaceId: result.workspace._id }, { $set: { yjsState: Buffer.from(state).toString("base64"), preview: version.code.slice(0, 240), lastSavedAt: new Date() } }, { upsert: true, returnDocument: "after" });
    return res.json({ success: true, restoredVersion: version.versionNumber });
}


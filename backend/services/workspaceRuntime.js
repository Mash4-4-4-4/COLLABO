import * as Y from "yjs";
import mongoose from "mongoose";
import WorkspaceDocument from "../models/WorkspcaeDocument.js";
import Workspace from "../models/Workspace.js";

const documents = new Map();
const pendingSaves = new Map();
let ioInstance;
export const STARTER_CODE = `public class Main {
    public static void main(String[] args) {

        // Write your Java code here

    }
}`;
export const isWorkspaceId = (id) => mongoose.Types.ObjectId.isValid(id);

export async function getWorkspaceDoc(workspaceId) {
    const key = String(workspaceId);
    if (documents.has(key)) return documents.get(key);
    const doc = new Y.Doc();
    const saved = await WorkspaceDocument.findOne({ workspaceId: key }).lean();
    if (saved?.yjsState) Y.applyUpdate(doc, new Uint8Array(Buffer.from(saved.yjsState, "base64")));
    else doc.getText("monaco").insert(0, STARTER_CODE);
    doc.on("update", () => scheduleSave(key, doc));
    documents.set(key, doc);
    return doc;
}

async function persistDoc(workspaceId, doc) {
    await WorkspaceDocument.findOneAndUpdate(
        { workspaceId },
        { $set: { yjsState: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"), preview: doc.getText("monaco").toString().slice(0, 240), lastSavedAt: new Date() } },
        { upsert: true, returnDocument: "after" }
    );
    await Workspace.updateOne({ _id: workspaceId }, { $set: { updatedAt: new Date() } });
}

function scheduleSave(workspaceId, doc) {
    const old = pendingSaves.get(workspaceId);
    if (old) clearTimeout(old);
    pendingSaves.set(workspaceId, setTimeout(async () => {
        pendingSaves.delete(workspaceId);
        try { await persistDoc(workspaceId, doc); }
        catch (error) { console.error("Debounced workspace save failed:", error); }
    }, 900));
}

export function installWorkspaceRuntime(io) {
    ioInstance = io;
    return {
        mergeWorkspaceState: async (workspaceId, update) => {
            const doc = await getWorkspaceDoc(workspaceId);
            Y.applyUpdate(doc, update);
            return Y.encodeStateAsUpdate(doc);
        },
        restoreWorkspaceCode: async (workspaceId, code) => {
            const doc = await getWorkspaceDoc(workspaceId);
            const text = doc.getText("monaco");
            doc.transact(() => {
                if (text.length) text.delete(0, text.length);
                if (code) text.insert(0, code);
            });
            const update = Y.encodeStateAsUpdate(doc);
            ioInstance?.to(String(workspaceId)).emit("code-update", update);
            return update;
        }
    };
}

export function applyWorkspaceUpdate(workspaceId, update, origin) {
    const doc = documents.get(String(workspaceId));
    if (!doc) return null;
    Y.applyUpdate(doc, update, origin);
    return doc;
}

export async function closeWorkspaceRuntime() {
    for (const timer of pendingSaves.values()) clearTimeout(timer);
    pendingSaves.clear();
    const results = await Promise.allSettled([...documents.entries()].map(([workspaceId, doc]) => persistDoc(workspaceId, doc)));
    results.filter((result) => result.status === "rejected").forEach((result) => console.error("Workspace shutdown flush failed:", result.reason));
    for (const doc of documents.values()) doc.destroy();
    documents.clear();
}

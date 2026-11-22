import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
    createWorkspace, listWorkspaces, getWorkspace, joinWorkspace, renameWorkspace, deleteWorkspace,
    saveWorkspace, inviteMember, listMembers, updateMemberRole, listVersions, createVersion, restoreVersion
} from "../controllers/workspaceController.js";
const router = express.Router();
router.use(authenticate);
router.get("/", listWorkspaces);
router.post("/", createWorkspace);
router.get("/:id", getWorkspace);
router.post("/:id/join", joinWorkspace);
router.patch("/:id", renameWorkspace);
router.delete("/:id", deleteWorkspace);
router.put("/:id/document", saveWorkspace);
router.get("/:id/members", listMembers);
router.post("/:id/members", inviteMember);
router.put("/:id/members/:userId", updateMemberRole);
router.get("/:id/versions", listVersions);
router.post("/:id/versions", createVersion);
router.post("/:id/versions/:versionId/restore", restoreVersion);
export default router;

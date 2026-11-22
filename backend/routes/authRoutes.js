import express from "express";
import { currentUser, login, register } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";
const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, currentUser);
export default router;

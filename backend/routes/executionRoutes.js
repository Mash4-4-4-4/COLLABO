import express from "express";
import { executeJava } from "../controllers/executionController.js";

const router = express.Router();

router.post("/java", executeJava);

export default router;
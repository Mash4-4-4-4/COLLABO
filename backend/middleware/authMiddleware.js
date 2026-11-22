import { verifyToken } from "../config/auth.js";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
    const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
    const userId = verifyToken(token);
    if (!userId) return res.status(401).json({ message: "Please sign in to continue" });
    const user = await User.findById(userId).select("username email avatar");
    if (!user) return res.status(401).json({ message: "Account not found" });
    req.user = user;
    next();
}

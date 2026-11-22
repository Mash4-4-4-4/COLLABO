import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import User from "../models/User.js";
import { signToken } from "../config/auth.js";

const publicUser = (user) => ({ id: user._id.toString(), username: user.username, email: user.email, avatar: user.avatar });

export async function register(req, res) {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (username.length < 2 || username.length > 50 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) {
        return res.status(400).json({ message: "Enter a username, valid email, and password of at least 8 characters" });
    }
    try {
        const salt = randomBytes(16).toString("hex");
        const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
        const user = await User.create({ username, email, passwordHash });
        return res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists" });
        console.error("Registration failed:", error);
        return res.status(500).json({ message: "Unable to create account" });
    }
}

export async function login(req, res) {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length > 200) return res.status(401).json({ message: "Invalid email or password" });
    const user = await User.findOne({ email });
    if (!user?.passwordHash) return res.status(401).json({ message: "Invalid email or password" });
    const [salt, saved] = user.passwordHash.split(":");
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(saved, "hex");
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return res.status(401).json({ message: "Invalid email or password" });
    return res.json({ token: signToken(user._id), user: publicUser(user) });
}

export async function currentUser(req, res) {
    return res.json({ user: publicUser(req.user) });
}

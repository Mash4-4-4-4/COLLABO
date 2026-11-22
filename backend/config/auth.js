import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.JWT_SECRET;

export function signToken(userId) {
    const key = secret();
    if (!key || key.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
    const payload = Buffer.from(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })).toString("base64url");
    const signature = createHmac("sha256", key).update(payload).digest("base64url");
    return `${payload}.${signature}`;
}

export function verifyToken(token) {
    const key = secret();
    if (!key || key.length < 32 || typeof token !== "string") return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", key).update(payload).digest();
    let supplied;
    try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return decoded.exp > Math.floor(Date.now() / 1000) ? decoded.sub : null;
    } catch { return null; }
}

import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const sessionAge = 24 * 60 * 60;
export type Session = { role: "admin" | "participant"; projectId?: string; version: string; expires: number };

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newGroupCode() {
  return randomBytes(18).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) || password.length > 256) return false;
  const [salt, expected] = hash.split(":");
  const key = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(expected, "hex"));
}

export function signSession(session: Session, secret: string) {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

export function readSession(token: string, secret: string): Session | null {
  try {
    if (token.length > 2048) return null;
    const [data, signature, extra] = token.split(".");
    if (!data || !signature || extra) return null;
    const expected = createHmac("sha256", secret).update(data).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(data, "base64url").toString());
    if (!["admin", "participant"].includes(session.role) || typeof session.version !== "string" ||
      !Number.isSafeInteger(session.expires) || session.expires <= Date.now() ||
      (session.projectId !== undefined && typeof session.projectId !== "string")) return null;
    return session;
  } catch { return null; }
}

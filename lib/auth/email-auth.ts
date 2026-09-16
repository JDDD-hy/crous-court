import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { BodyTooLargeError, readLimitedText } from "@/lib/http/read-limited-body";
import { getLocale } from "@/lib/i18n/server";
import { verificationEmail } from "@/lib/i18n/email";

const OTP_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_SEND_LIMIT = 3;
const EMAIL_SEND_WINDOW_SECONDS = 60 * 60;
const LOCAL_COOKIE = "crous_session";
const SECURE_COOKIE = "__Host-crous_session";

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function requestEmailCode(request: Request, rawEmail: unknown) {
  assertSameOrigin(request);
  const email = normalizeEmail(rawEmail);
  const secret = authSecret();
  const db = getRawDb();
  const now = epoch();
  const emailDigest = await hmac(secret, `email\0${email}`);
  const ipDigest = await hmac(secret, `ip\0${clientIp(request)}`);
  const challengeId = crypto.randomUUID();
  const code = randomDigits();
  const codeDigest = await hmac(secret, `otp\0${challengeId}\0${code}`);
  const admitted = await db.prepare(`INSERT INTO email_otp_challenges (id,email_digest,code_digest,ip_digest,expires_at,created_at)
    SELECT ?,?,?,?,?,?
    WHERE (SELECT COUNT(*) FROM email_otp_challenges WHERE email_digest = ? AND created_at >= ?) < ${EMAIL_SEND_LIMIT}
      AND (SELECT COUNT(*) FROM email_otp_challenges WHERE ip_digest = ? AND created_at >= ?) < 10
      AND NOT EXISTS (SELECT 1 FROM email_otp_challenges WHERE email_digest = ? AND created_at > ?)`)
    .bind(challengeId, emailDigest, codeDigest, ipDigest, now + OTP_TTL_SECONDS, now, emailDigest, now - EMAIL_SEND_WINDOW_SECONDS, ipDigest, now - 900, emailDigest, now - 60).run();
  if (admitted.meta.changes !== 1) throw new AuthError("请求过于频繁，请稍后再试", 429);
  try {
    const devCode = await deliverCode(request, email, code);
    await db.prepare("UPDATE email_otp_challenges SET consumed_at = ? WHERE email_digest = ? AND id <> ? AND consumed_at IS NULL").bind(now, emailDigest, challengeId).run();
    return { challengeId, devCode };
  } catch (error) {
    await db.prepare("DELETE FROM email_otp_challenges WHERE id = ?").bind(challengeId).run();
    if (error instanceof AuthError) throw error;
    throw new AuthError("验证码暂时无法发送，请稍后再试", 503);
  }
}

export async function verifyEmailCode(request: Request, rawEmail: unknown, challengeId: unknown, rawCode: unknown) {
  assertSameOrigin(request);
  const email = normalizeEmail(rawEmail);
  if (typeof challengeId !== "string" || !/^[0-9a-f-]{36}$/.test(challengeId)) throw invalidCode();
  if (typeof rawCode !== "string" || !/^\d{6}$/.test(rawCode)) throw invalidCode();
  const secret = authSecret();
  const db = getRawDb();
  const now = epoch();
  const emailDigest = await hmac(secret, `email\0${email}`);
  const challenge = await db.prepare(`UPDATE email_otp_challenges SET attempts = attempts + 1
    WHERE id = ? AND email_digest = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5
    RETURNING code_digest`).bind(challengeId, emailDigest, now).first<{ code_digest: string }>();
  if (!challenge) throw invalidCode();
  const codeDigest = await hmac(secret, `otp\0${challengeId}\0${rawCode}`);
  if (!constantTimeEqual(challenge.code_digest, codeDigest)) {
    throw invalidCode();
  }

  const userId = crypto.randomUUID();
  const sessionMarker = crypto.randomUUID();
  const sessionToken = randomToken();
  const tokenDigest = await sha256(sessionToken);
  await db.batch([
    db.prepare("INSERT INTO users (id,email_digest) VALUES (?,?) ON CONFLICT(email_digest) DO NOTHING").bind(userId, emailDigest),
    db.prepare("UPDATE email_otp_challenges SET consumed_at = ?, session_id = ? WHERE id = ? AND email_digest = ? AND code_digest = ? AND consumed_at IS NULL AND expires_at > ? AND attempts <= 5").bind(now, sessionMarker, challengeId, emailDigest, codeDigest, now),
    db.prepare("INSERT INTO auth_sessions (token_digest,user_id,expires_at,created_at) SELECT ?,id,?,? FROM users WHERE email_digest = ? AND EXISTS (SELECT 1 FROM email_otp_challenges WHERE id = ? AND session_id = ?)").bind(tokenDigest, now + SESSION_TTL_SECONDS, now, emailDigest, challengeId, sessionMarker),
  ]);
  const created = await db.prepare("SELECT user_id FROM auth_sessions WHERE token_digest = ?").bind(tokenDigest).first();
  if (!created) throw invalidCode();
  return { cookie: sessionCookie(request, sessionToken, SESSION_TTL_SECONDS) };
}

export async function getEmailUser(): Promise<{ userId: string } | null> {
  const jar = await cookies();
  const token = env.AUTH_MODE === "local" || env.AUTH_MODE === "local-resend"
    ? jar.get(LOCAL_COOKIE)?.value
    : jar.get(SECURE_COOKIE)?.value;
  if (!token) return null;
  const db = getRawDb();
  const row = await db.prepare("SELECT user_id FROM auth_sessions WHERE token_digest = ? AND revoked_at IS NULL AND expires_at > ?").bind(await sha256(token), epoch()).first<{ user_id: string }>();
  return row ? { userId: row.user_id } : null;
}

export async function isAdminUser(userId: string) {
  const configured = env.ADMIN_EMAILS?.split(",").map((email) => email.trim()).filter(Boolean) ?? [];
  if (!configured.length) return false;
  const row = await getRawDb().prepare("SELECT email_digest FROM users WHERE id = ?").bind(userId).first<{ email_digest: string | null }>();
  if (!row?.email_digest) return false;
  const secret = authSecret();
  const digests = await Promise.all(configured.map((email) => hmac(secret, `email\0${normalizeEmail(email)}`)));
  return digests.some((digest) => constantTimeEqual(digest, row.email_digest!));
}

export async function requireAdminUser() {
  const user = await getEmailUser();
  if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
  if (!await isAdminUser(user.userId)) throw new AuthError("没有管理权限", 403);
  return user;
}

export async function logoutEmailUser(request: Request) {
  assertSameOrigin(request);
  const cookie = request.headers.get("cookie") ?? "";
  const token = readCookie(cookie, isLoopback(new URL(request.url)) ? LOCAL_COOKIE : SECURE_COOKIE);
  if (token) {
    const db = getRawDb();
    await db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_digest = ? AND revoked_at IS NULL").bind(epoch(), await sha256(token)).run();
  }
  return sessionCookie(request, "", 0);
}

export function assertSameOrigin(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (isLoopback(url) && !origin) return;
  if (!origin || origin !== url.origin) throw new AuthError("拒绝跨站请求", 403);
}

export async function parseJsonRequest(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AuthError("请求格式无效", 415);
  let body: string;
  try { body = await readLimitedText(request, 2048); }
  catch (error) { if (error instanceof BodyTooLargeError) throw new AuthError("请求格式无效", 413); throw error; }
  if (!body) throw new AuthError("请求格式无效", 400);
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected object");
    return parsed as Record<string, unknown>;
  }
  catch { throw new AuthError("请求格式无效", 400); }
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") throw new AuthError("请输入有效邮箱地址");
  const trimmed = value.normalize("NFC").trim();
  const at = trimmed.lastIndexOf("@");
  const email = at < 1 ? trimmed : `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("请输入有效邮箱地址");
  return email;
}

function authSecret() {
  const secret = env.AUTH_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new AuthError("登录服务尚未配置", 503);
  return secret;
}

async function deliverCode(request: Request, email: string, code: string) {
  if (env.AUTH_MODE === "local" && isLoopback(new URL(request.url))) return code;
  if (!env.RESEND_API_KEY || !env.OTP_FROM_EMAIL) throw new AuthError("邮件服务尚未配置", 503);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.OTP_FROM_EMAIL,
      to: [email],
      ...verificationEmail(await getLocale(), code),
    }),
  });
  if (!response.ok) throw new AuthError("验证码暂时无法发送，请稍后再试", 503);
  return null;
}

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? (isLoopback(new URL(request.url)) ? "loopback" : "unknown");
}

function isLoopback(url: URL) { return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]"; }
function epoch() { return Math.floor(Date.now() / 1000); }
function invalidCode() { return new AuthError("验证码无效或已过期"); }
function randomDigits() { const bytes = crypto.getRandomValues(new Uint32Array(1)); return String(bytes[0] % 1_000_000).padStart(6, "0"); }
function randomToken() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
async function sha256(value: string) { return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
async function hmac(secret: string, value: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))); }
function constantTimeEqual(left: string, right: string) { if (left.length !== right.length) return false; let mismatch = 0; for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i); return mismatch === 0; }
function readCookie(header: string, name: string) { for (const part of header.split(";")) { const [key, ...rest] = part.trim().split("="); if (key === name) return rest.join("="); } return null; }
function sessionCookie(request: Request, value: string, maxAge: number) { const local = isLoopback(new URL(request.url)); const name = local ? LOCAL_COOKIE : SECURE_COOKIE; return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${local ? "" : "; Secure"}`; }

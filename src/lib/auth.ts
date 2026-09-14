import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 로그인/권한 (PRD FR-001).
 * Google OIDC로 이메일을 확인하고, D1 `app_users`에 등록된(허가된) 계정만 세션을 발급한다.
 * 세션은 HMAC-SHA256 서명 쿠키(`hj_session`)이며 서버 저장소가 없다.
 *
 * 필요한 env (Worker secret / 로컬 .dev.vars):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET(32자 이상 임의 문자열)
 *   AUTH_ORIGIN(선택, 콜백 origin 강제) · AUTH_DEV_BYPASS=1(로컬 전용, 로그인 생략)
 */

export type Role = "관리자" | "편집자";

export function isAdmin(user: { role: Role } | null | undefined): boolean {
  return user?.role === "관리자";
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  picture?: string;
}

export const SESSION_COOKIE = "hj_session";
export const STATE_COOKIE = "hj_oauth_state";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7;

export async function getAuthEnv(): Promise<Record<string, string | undefined>> {
  const merged: Record<string, string | undefined> = { ...(process.env as Record<string, string | undefined>) };
  try {
    const { env } = await getCloudflareContext({ async: true });
    Object.assign(merged, env as unknown as Record<string, string | undefined>);
  } catch {
    /* dev/mock: process.env만 사용 */
  }
  return merged;
}

export async function isAuthConfigured(): Promise<boolean> {
  const env = await getAuthEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.AUTH_SECRET);
}

/* ── 서명 ─────────────────────────────────────────────────────── */

const enc = new TextEncoder();
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** base64url → UTF-8 문자열. atob는 바이트를 Latin-1 문자로 돌려주므로 TextDecoder로 다시 풀어야 한글이 깨지지 않는다. */
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signSession(user: CurrentUser, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC })));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<CurrentUser | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(secret, payload)) !== sig) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload)) as CurrentUser & { exp: number };
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    const { exp: _exp, ...user } = data;
    // 0017 이전 쿠키 호환
    const legacy = user.role as string;
    if (legacy === "운영관리자") user.role = "관리자";
    else if (legacy !== "관리자") user.role = "편집자";
    return user;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: SESSION_TTL_SEC };
}

/* ── 현재 사용자 ─────────────────────────────────────────────── */

const DEV_USER: CurrentUser = { id: "dev-bypass", email: "dev@local", name: "로컬 개발자", role: "관리자" };

/** 세션 쿠키를 검증해 현재 사용자를 돌려준다. 없거나 깨졌으면 null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const env = await getAuthEnv();
  if (env.AUTH_DEV_BYPASS === "1") return DEV_USER;
  if (!env.AUTH_SECRET) return null;
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, env.AUTH_SECRET);
}

export function randomToken(bytes = 16): string {
  const u8 = new Uint8Array(bytes);
  crypto.getRandomValues(u8);
  return b64url(u8);
}

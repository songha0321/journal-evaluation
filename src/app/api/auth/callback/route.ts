import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthEnv, signSession, sessionCookieOptions, SESSION_COOKIE, STATE_COOKIE, type CurrentUser, type Role } from "@/lib/auth";
import { exchangeCode } from "@/lib/auth-google";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AppUserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/** Google 콜백. state 대조 → 토큰 교환 → app_users 허가 확인 → 세션 쿠키 발급. */
export async function GET(req: Request) {
  const env = await getAuthEnv();
  const url = new URL(req.url);
  const origin = env.AUTH_ORIGIN || url.origin;
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${reason}`);

  const jar = await cookies();
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const saved = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!code || !state || !saved || state !== saved) return fail("oauth");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.AUTH_SECRET) return fail("config");

  let identity;
  try {
    identity = await exchangeCode(code, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, origin);
  } catch (e) {
    console.error("[auth] google exchange failed:", e);
    return fail("oauth");
  }

  const row = await queryOne<AppUserRow>(
    "SELECT id, email, name, role FROM app_users WHERE email = ? AND is_active = 1",
    [identity.email],
  );
  if (!row) return fail("unauthorized");

  const user: CurrentUser = {
    id: row.id,
    email: row.email,
    name: row.name || identity.name,
    role: row.role,
    picture: identity.picture,
  };
  await queryOne("UPDATE app_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);

  const token = await signSession(user, env.AUTH_SECRET);
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(origin.startsWith("https")));
  return NextResponse.redirect(`${origin}/ax`);
}

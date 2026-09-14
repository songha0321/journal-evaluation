import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, getAuthEnv, signSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { getDB } from "@/lib/db";

/** 내 표시 이름 변경. app_users.name을 바꾸고 세션 쿠키를 새로 발급한다. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (b.name ?? "").trim();
  if (!name || name.length > 30) return NextResponse.json({ error: "이름은 1~30자여야 합니다." }, { status: 400 });

  if (user.id !== "dev-bypass") {
    const db = await getDB();
    await db.prepare("UPDATE app_users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(name, user.id).run();
  }
  const env = await getAuthEnv();
  const next = { ...user, name };
  if (env.AUTH_SECRET && user.id !== "dev-bypass") {
    const origin = env.AUTH_ORIGIN || new URL(req.url).origin;
    const jar = await cookies();
    jar.set(SESSION_COOKIE, await signSession(next, env.AUTH_SECRET), sessionCookieOptions(origin.startsWith("https")));
  }
  return NextResponse.json({ ok: true, name });
}

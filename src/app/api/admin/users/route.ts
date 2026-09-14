import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin, type Role } from "@/lib/auth";
import { getDB, query } from "@/lib/db";

const ROLES = new Set<Role>(["관리자", "편집자"]);

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { err: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdmin(user)) return { err: NextResponse.json({ error: "관리자만 할 수 있습니다." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard();
  if (g.err) return g.err;
  const rows = await query("SELECT id, email, name, role, is_active, last_login_at, created_at FROM app_users ORDER BY created_at");
  return NextResponse.json({ users: rows });
}

/** 계정 추가. 기본 역할 편집자 */
export async function POST(req: Request) {
  const g = await guard();
  if (g.err) return g.err;
  const b = (await req.json().catch(() => ({}))) as { email?: string; name?: string; role?: Role };
  const email = (b.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "이메일 형식이 아닙니다." }, { status: 400 });
  const role: Role = b.role && ROLES.has(b.role) ? b.role : "편집자";
  const db = await getDB();
  try {
    await db.prepare("INSERT INTO app_users (email, name, role) VALUES (?,?,?)").bind(email, (b.name ?? "").trim() || null, role).run();
  } catch {
    return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

/** 역할·활성·이름 변경. 자기 자신의 관리자 권한은 뺄 수 없다(마지막 관리자 보호) */
export async function PATCH(req: Request) {
  const g = await guard();
  if (g.err) return g.err;
  const b = (await req.json().catch(() => ({}))) as { id?: string; role?: Role; is_active?: boolean; name?: string };
  if (!b.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  if (b.id === g.user!.id && ((b.role && b.role !== "관리자") || b.is_active === false)) {
    return NextResponse.json({ error: "자기 자신의 관리자 권한이나 활성 상태는 바꿀 수 없습니다." }, { status: 400 });
  }
  if (b.role && !ROLES.has(b.role)) return NextResponse.json({ error: "역할 값 오류" }, { status: 400 });
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.role) {
    sets.push("role = ?");
    vals.push(b.role);
  }
  if (typeof b.is_active === "boolean") {
    sets.push("is_active = ?");
    vals.push(b.is_active ? 1 : 0);
  }
  if (typeof b.name === "string") {
    sets.push("name = ?");
    vals.push(b.name.trim() || null);
  }
  if (!sets.length) return NextResponse.json({ error: "바꿀 값이 없습니다." }, { status: 400 });
  vals.push(b.id);
  await db.prepare(`UPDATE app_users SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...vals).run();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDB } from "@/lib/db";

/** 변경 항목 댓글: 추가(POST) / 삭제(DELETE, 본인만) */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { article_id?: string; edit_key?: string; body?: string };
  const body = (b.body ?? "").trim();
  if (!b.article_id || !b.edit_key || !body) return NextResponse.json({ error: "article_id, edit_key, body 필요" }, { status: 400 });
  if (body.length > 2000) return NextResponse.json({ error: "댓글은 2000자까지입니다." }, { status: 400 });
  const db = await getDB();
  const id = "ecm_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await db
    .prepare("INSERT INTO ax_edit_comment (id, article_id, edit_key, author_email, author_name, body) VALUES (?,?,?,?,?,?)")
    .bind(id, b.article_id, b.edit_key, user.email, user.name, body)
    .run();
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  const r = await db.prepare("DELETE FROM ax_edit_comment WHERE id = ? AND author_email = ?").bind(id, user.email).run();
  return NextResponse.json({ ok: true, deleted: r.meta.changes });
}

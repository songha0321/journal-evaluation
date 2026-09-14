import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDB } from "@/lib/db";

const KINDS = new Set(["typo", "sensitive", "term", "structure", "flow"]);

/** 변경 항목의 규칙 라벨을 편집자가 고쳐 저장 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { article_id?: string; edit_key?: string; kind?: string };
  if (!b.article_id || !b.edit_key || !b.kind || !KINDS.has(b.kind)) return NextResponse.json({ error: "입력 오류" }, { status: 400 });
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO ax_edit_label (article_id, edit_key, kind, updated_by) VALUES (?,?,?,?)
       ON CONFLICT(article_id, edit_key) DO UPDATE SET kind = excluded.kind, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(b.article_id, b.edit_key, b.kind, user.name)
    .run();
  return NextResponse.json({ ok: true });
}

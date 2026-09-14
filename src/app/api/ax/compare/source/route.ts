import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDB } from "@/lib/db";

/** 원문 확정: articles.qna_id 저장 (null이면 해제) */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { article_id?: string; qna_ids?: string[] };
  if (!b.article_id || !Array.isArray(b.qna_ids)) return NextResponse.json({ error: "article_id, qna_ids 필요" }, { status: 400 });
  const ids = b.qna_ids.filter((x) => typeof x === "string" && x);
  const db = await getDB();
  await db
    .prepare("UPDATE articles SET qna_id = ?, qna_ids_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(ids[0] ?? null, ids.length ? JSON.stringify(ids) : null, b.article_id)
    .run();
  return NextResponse.json({ ok: true });
}

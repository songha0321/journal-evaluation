import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * AI 원고 탈고 '요청'만 기록한다. 실행은 로컬 러너가 맡는다(선별과 같은 구조).
 * 목차 단위(toc_id) 또는 원고 단위(ms_ids)로 요청할 수 있다.
 */
export async function POST(req: Request) {
  const b = (await req.json()) as { toc_id?: string; ms_ids?: string[] };
  const db = await getDB();

  let ids = b.ms_ids ?? [];
  if (!ids.length && b.toc_id) {
    const rows = await db
      .prepare(`SELECT id FROM ax_manuscript WHERE toc_id = ?`)
      .bind(b.toc_id)
      .all<{ id: string }>();
    ids = (rows.results ?? []).map((r) => r.id);
  }
  if (!ids.length) return NextResponse.json({ error: "ms_ids 또는 toc_id 필요" }, { status: 400 });

  const ph = ids.map(() => "?").join(",");
  await db
    .prepare(
      `UPDATE ax_manuscript
          SET revise_status = 'queued', revise_requested_at = CURRENT_TIMESTAMP,
              revise_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${ph})`,
    )
    .bind(...ids)
    .run();

  return NextResponse.json({ queued: ids.length });
}

/** 탈고 큐 상태 폴링 */
export async function GET(req: Request) {
  const tocId = new URL(req.url).searchParams.get("toc_id");
  if (!tocId) return NextResponse.json({ error: "toc_id 필요" }, { status: 400 });
  const db = await getDB();
  const rows = await db
    .prepare(
      `SELECT m.id, a.name, m.revise_status, m.revise_error, m.status, m.updated_at
         FROM ax_manuscript m JOIN authors a ON a.id = m.author_id
        WHERE m.toc_id = ? ORDER BY m.created_at`,
    )
    .bind(tocId)
    .all();
  const runner = await db
    .prepare(`SELECT last_seen_at, status, note FROM ax_runner WHERE id = 'runner'`)
    .first();
  return NextResponse.json({ manuscripts: rows.results ?? [], runner });
}

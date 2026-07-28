import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * AI 수기 선별 '요청'만 기록한다. 실제 실행은 로컬 러너(scripts/ax-runner.mjs)가 맡는다.
 * 배포된 Worker에서는 CLI를 실행할 수 없으므로 여기서 LLM을 호출하지 않는다.
 */
export async function POST(req: Request) {
  const b = (await req.json()) as { toc_ids?: string[]; issue_id?: string };
  const db = await getDB();

  let ids = b.toc_ids ?? [];
  if (!ids.length && b.issue_id) {
    const rows = await db
      .prepare(`SELECT id FROM ax_toc WHERE issue_id = ?`)
      .bind(b.issue_id)
      .all<{ id: string }>();
    ids = (rows.results ?? []).map((r) => r.id);
  }
  if (!ids.length) return NextResponse.json({ error: "toc_ids 또는 issue_id 필요" }, { status: 400 });

  // 목차내용이 비어 있으면 러너가 처리할 수 없다. 큐에 넣기 전에 거른다.
  const placeholders = ids.map(() => "?").join(",");
  const bad = await db
    .prepare(
      `SELECT id, title FROM ax_toc
        WHERE id IN (${placeholders}) AND TRIM(COALESCE(toc_content,'')) = ''`,
    )
    .bind(...ids)
    .all<{ id: string; title: string }>();
  if ((bad.results ?? []).length) {
    return NextResponse.json(
      { error: `목차내용이 비어 있습니다: ${(bad.results ?? []).map((r) => r.title).join(", ")}` },
      { status: 400 },
    );
  }

  await db
    .prepare(
      `UPDATE ax_toc
          SET shortlist_status = 'queued',
              shortlist_requested_at = CURRENT_TIMESTAMP,
              shortlist_started_at = NULL,
              shortlist_progress = NULL,
              shortlist_error = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})`,
    )
    .bind(...ids)
    .run();

  return NextResponse.json({ queued: ids.length });
}

/** 큐 상태 폴링 — 진행률 표시용 */
export async function GET(req: Request) {
  const issueId = new URL(req.url).searchParams.get("issue_id");
  if (!issueId) return NextResponse.json({ error: "issue_id 필요" }, { status: 400 });
  const db = await getDB();
  const rows = await db
    .prepare(
      `SELECT id, title, shortlist_status, shortlist_progress, shortlist_error, shortlisted_at
         FROM ax_toc WHERE issue_id = ?
        ORDER BY (part_no IS NULL), part_no, (chapter_no IS NULL), chapter_no`,
    )
    .bind(issueId)
    .all();
  const runner = await db
    .prepare(`SELECT last_seen_at, status, note FROM ax_runner WHERE id = 'runner'`)
    .first();
  return NextResponse.json({ tocs: rows.results ?? [], runner });
}

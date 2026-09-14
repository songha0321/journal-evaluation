import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * 편집자 수기 확정 (PROCESS.md S3).
 * 선택된 qna 행을 ax_manuscript로 올린다. 선택 해제된 행은 삭제되어 후보 풀로 복귀한다
 * (SELECTION.md §6 마지막 항목 — 이게 없으면 뺀 수기가 영구히 사용 불가가 된다).
 */
export async function POST(req: Request) {
  const b = (await req.json()) as { toc_id?: string; qna_ids?: string[] };
  if (!b.toc_id || !Array.isArray(b.qna_ids)) {
    return NextResponse.json({ error: "toc_id, qna_ids 필요" }, { status: 400 });
  }
  const db = await getDB();
  const keep = b.qna_ids;
  const user = await getCurrentUser();

  // 1) 선택 해제분 삭제 → 해당 qna는 다시 후보가 된다.
  if (keep.length) {
    const ph = keep.map(() => "?").join(",");
    await db
      .prepare(`DELETE FROM ax_manuscript WHERE toc_id = ? AND qna_id NOT IN (${ph})`)
      .bind(b.toc_id, ...keep)
      .run();
  } else {
    await db.prepare(`DELETE FROM ax_manuscript WHERE toc_id = ?`).bind(b.toc_id).run();
  }

  // 2) 신규 선택분 삽입. 다른 목차가 이미 쓴 qna는 UNIQUE(qna_id)에 걸려 건너뛴다.
  const skipped: string[] = [];
  for (const qnaId of keep) {
    const cand = await db
      .prepare(
        `SELECT author_id, reason, episode_json, content_hash FROM ax_candidate
          WHERE toc_id = ? AND qna_id = ?`,
      )
      .bind(b.toc_id, qnaId)
      .first<{ author_id: string; reason: string | null; episode_json: string | null; content_hash: string | null }>();
    if (!cand) {
      skipped.push(qnaId);
      continue;
    }
    try {
      await db
        .prepare(
          `INSERT INTO ax_manuscript
             (id, toc_id, author_id, qna_id, content_hash, episode_json, select_reason, status)
           VALUES (?,?,?,?,?,?,?, 'confirmed')
           ON CONFLICT(qna_id) DO NOTHING`,
        )
        .bind(
          "ms_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12),
          b.toc_id,
          cand.author_id,
          qnaId,
          cand.content_hash,
          cand.episode_json,
          cand.reason,
        )
        .run();
    } catch {
      skipped.push(qnaId);
    }
  }

  // 3) 목차의 확정 시각·확정자 기록 (S3 완료). 0014 confirmed_by
  await db
    .prepare(`UPDATE ax_toc SET confirmed_at = CURRENT_TIMESTAMP, confirmed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(user?.name ?? null, b.toc_id)
    .run();

  const n = await db
    .prepare(`SELECT COUNT(*) n FROM ax_manuscript WHERE toc_id = ?`)
    .bind(b.toc_id)
    .first<{ n: number }>();

  return NextResponse.json({ confirmed: n?.n ?? 0, skipped });
}

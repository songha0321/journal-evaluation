import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * 목차 단위 '원고 확정' (PROCESS.md S5 완료).
 * 이 시각이 찍혀야 '원고 다운로드'가 열린다.
 *
 * 확정 조건 두 가지를 서버에서 다시 검사한다 — 화면에서 막더라도 여기서 한 번 더 본다.
 *  1) 모든 원고가 status='final'
 *  2) 소제목 입력 상태가 목차 전체에서 동일 (전부 입력 또는 전부 미입력)
 */
export async function POST(req: Request) {
  const b = (await req.json()) as { toc_id?: string };
  if (!b.toc_id) return NextResponse.json({ error: "toc_id 필요" }, { status: 400 });

  const db = await getDB();
  const stat = await db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN status = 'final' THEN 1 ELSE 0 END) finals,
              SUM(CASE WHEN TRIM(COALESCE(subtitle,'')) <> '' THEN 1 ELSE 0 END) with_subtitle,
              SUM(needs_review) reviews
         FROM ax_manuscript WHERE toc_id = ?`,
    )
    .bind(b.toc_id)
    .first<{ total: number; finals: number; with_subtitle: number; reviews: number }>();

  const total = stat?.total ?? 0;
  if (total === 0) return NextResponse.json({ error: "확정할 원고가 없습니다." }, { status: 409 });
  if ((stat?.finals ?? 0) < total) {
    return NextResponse.json(
      { error: `아직 확정되지 않은 원고가 ${total - (stat?.finals ?? 0)}건 있습니다.` },
      { status: 409 },
    );
  }
  const sub = stat?.with_subtitle ?? 0;
  if (sub !== 0 && sub !== total) {
    return NextResponse.json(
      { error: `소제목이 일부에만 입력되어 있습니다 (${sub}/${total}). 전부 입력하거나 전부 비워야 합니다.` },
      { status: 409 },
    );
  }
  if ((stat?.reviews ?? 0) > 0) {
    return NextResponse.json(
      { error: `검수 필요로 표시된 원고가 ${stat?.reviews}건 있습니다. 먼저 처리하세요.` },
      { status: 409 },
    );
  }

  await db
    .prepare(`UPDATE ax_toc SET finalized_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(b.toc_id)
    .run();

  return NextResponse.json({ ok: true, finalized: total });
}

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * 원고 저장 — 탈고문·소제목·comment·밑줄·교정 승인 상태.
 * status: 'edited'(저장됨) / 'final'(확정됨). 목록의 상태 배지가 이 값을 따른다.
 */
export async function POST(req: Request) {
  const b = (await req.json()) as {
    id: string;
    subtitle?: string | null;
    comment?: string | null;
    edited_text?: string | null;
    revision_json?: string | null;
    highlights_json?: string | null;
    status?: "edited" | "final";
    needs_review?: 0 | 1;
    review_note?: string | null;
  };
  if (!b.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const db = await getDB();
  await db
    .prepare(
      `UPDATE ax_manuscript
          SET subtitle        = COALESCE(?, subtitle),
              comment         = COALESCE(?, comment),
              edited_text     = COALESCE(?, edited_text),
              revision_json   = COALESCE(?, revision_json),
              highlights_json = COALESCE(?, highlights_json),
              status          = COALESCE(?, status),
              needs_review    = COALESCE(?, needs_review),
              review_note     = COALESCE(?, review_note),
              updated_at      = CURRENT_TIMESTAMP
        WHERE id = ?`,
    )
    .bind(
      b.subtitle ?? null,
      b.comment ?? null,
      b.edited_text ?? null,
      b.revision_json ?? null,
      b.highlights_json ?? null,
      b.status ?? null,
      b.needs_review ?? null,
      b.review_note ?? null,
      b.id,
    )
    .run();

  const row = await db
    .prepare(`SELECT status, updated_at FROM ax_manuscript WHERE id = ?`)
    .bind(b.id)
    .first<{ status: string; updated_at: string }>();

  return NextResponse.json({ ok: true, status: row?.status, updated_at: row?.updated_at });
}

/** 원고 삭제 — 선별 취소. 해당 qna는 후보 풀로 복귀한다. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  await db.prepare(`DELETE FROM ax_manuscript WHERE id = ?`).bind(id).run();
  return NextResponse.json({ ok: true });
}

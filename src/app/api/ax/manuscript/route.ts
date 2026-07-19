import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// 원고 저장(탈고문·comment·소제목·밑줄·상태).
export async function POST(req: Request) {
  const b = (await req.json()) as {
    id: string;
    subtitle?: string | null;
    comment?: string | null;
    edited_text?: string | null;
    highlights_json?: string | null;
    status?: string;
  };
  if (!b.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  await db
    .prepare(
      `UPDATE ax_manuscript
       SET subtitle = COALESCE(?, subtitle),
           comment = COALESCE(?, comment),
           edited_text = COALESCE(?, edited_text),
           highlights_json = COALESCE(?, highlights_json),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      b.subtitle ?? null,
      b.comment ?? null,
      b.edited_text ?? null,
      b.highlights_json ?? null,
      b.status ?? null,
      b.id,
    )
    .run();
  return NextResponse.json({ ok: true });
}

// 원고 삭제(선별 취소 → 다른 목차에 재배치 가능).
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  await db.prepare(`DELETE FROM ax_manuscript WHERE id = ?`).bind(id).run();
  return NextResponse.json({ ok: true });
}

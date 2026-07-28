import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/** 목차 생성 */
export async function POST(req: Request) {
  const b = (await req.json()) as {
    issue_id: string;
    part_no?: number | null;
    chapter_no?: number | null;
    title?: string;
    toc_content?: string;
    hanmadi?: string;
    select_count?: number;
  };
  if (!b.issue_id) return NextResponse.json({ error: "issue_id 필요" }, { status: 400 });

  const db = await getDB();
  const id = "toc_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await db
    .prepare(
      `INSERT INTO ax_toc (id, issue_id, part_no, chapter_no, title, toc_content, hanmadi, select_count)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      b.issue_id,
      b.part_no ?? null,
      b.chapter_no ?? null,
      (b.title ?? "").trim() || "제목 없음",
      b.toc_content ?? null,
      b.hanmadi ?? null,
      b.select_count ?? 10,
    )
    .run();
  return NextResponse.json({ toc_id: id });
}

/**
 * 목차 수정. [GNB1] 목차 입력과 [GNB3] AI 원고 탈고 양쪽에서 호출하며,
 * 어느 쪽에서 고쳐도 같은 행을 갱신하므로 두 화면의 노출값이 항상 일치한다.
 */
export async function PATCH(req: Request) {
  const b = (await req.json()) as {
    id: string;
    part_no?: number | null;
    chapter_no?: number | null;
    title?: string;
    toc_content?: string;
    hanmadi?: string;
    select_count?: number;
  };
  if (!b.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const db = await getDB();
  await db
    .prepare(
      `UPDATE ax_toc
          SET part_no      = ?,
              chapter_no   = ?,
              title        = COALESCE(?, title),
              toc_content  = COALESCE(?, toc_content),
              hanmadi      = COALESCE(?, hanmadi),
              select_count = COALESCE(?, select_count),
              updated_at   = CURRENT_TIMESTAMP
        WHERE id = ?`,
    )
    .bind(
      b.part_no ?? null,
      b.chapter_no ?? null,
      b.title?.trim() || null,
      b.toc_content ?? null,
      b.hanmadi ?? null,
      b.select_count ?? null,
      b.id,
    )
    .run();
  return NextResponse.json({ ok: true });
}

/** 목차 삭제 — 후보와 확정 원고도 함께 지운다(확정 원고가 지워지면 해당 qna가 후보 풀로 복귀). */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  await db.prepare(`DELETE FROM ax_manuscript WHERE toc_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM ax_candidate WHERE toc_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM ax_toc WHERE id = ?`).bind(id).run();
  return NextResponse.json({ ok: true });
}

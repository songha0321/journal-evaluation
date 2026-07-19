import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// 선별 확정: 목차 생성 + 선택 수기를 ax_manuscript에 저장(작성자당 1개 목차 = UNIQUE).
export async function POST(req: Request) {
  const body = (await req.json()) as {
    project?: string;
    issue?: string;
    part_no?: number | null;
    chapter_no?: number | null;
    title: string;
    toc_content?: string;
    hanmadi?: string;
    cohort?: number | null;
    select_count?: number;
    author_ids: string[];
  };
  if (!body.title || !Array.isArray(body.author_ids)) {
    return NextResponse.json({ error: "title, author_ids 필요" }, { status: 400 });
  }
  const db = await getDB();
  const tocId = "toc_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await db
    .prepare(
      `INSERT INTO ax_toc (id, project, issue, part_no, chapter_no, title, toc_content, hanmadi, cohort, select_count)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      tocId,
      body.project || "2027 항해일지",
      body.issue || "1호차",
      body.part_no ?? null,
      body.chapter_no ?? null,
      body.title,
      body.toc_content ?? null,
      body.hanmadi ?? null,
      body.cohort ?? null,
      body.select_count ?? body.author_ids.length,
    )
    .run();

  const skipped: string[] = [];
  for (const aid of body.author_ids) {
    const msId = "ms_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    try {
      await db
        .prepare(
          `INSERT INTO ax_manuscript (id, toc_id, author_id, status) VALUES (?,?,?, 'selected')`,
        )
        .bind(msId, tocId, aid)
        .run();
    } catch {
      // UNIQUE(author_id) 위반 = 이미 다른 목차에 게재됨 → 중복 게재 금지
      skipped.push(aid);
    }
  }
  return NextResponse.json({ toc_id: tocId, added: body.author_ids.length - skipped.length, skipped });
}

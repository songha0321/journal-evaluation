import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/** 호차 생성 */
export async function POST(req: Request) {
  const b = (await req.json()) as {
    project?: string;
    issue_label?: string;
    cohort?: number | null;
    sort_order?: number;
  };
  const label = (b.issue_label ?? "").trim();
  if (!label) return NextResponse.json({ error: "호차명을 입력하세요." }, { status: 400 });

  const db = await getDB();
  const id = "issue_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  try {
    await db
      .prepare(
        `INSERT INTO ax_issue (id, project, issue_label, sort_order, status, cohort)
         VALUES (?,?,?,?, 'editing', ?)`,
      )
      .bind(id, (b.project ?? "2027 항해일지").trim(), label, b.sort_order ?? 0, b.cohort ?? null)
      .run();
  } catch {
    // UNIQUE(project, issue_label)
    return NextResponse.json({ error: "같은 프로젝트에 이미 있는 호차입니다." }, { status: 409 });
  }
  return NextResponse.json({ issue_id: id });
}

/** 호차 상태 변경 (편집 중 → 발간 완료) */
export async function PATCH(req: Request) {
  const b = (await req.json()) as { id: string; status?: "editing" | "published" | "archived" };
  if (!b.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const db = await getDB();
  await db
    .prepare(
      `UPDATE ax_issue
          SET status = COALESCE(?, status),
              published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
        WHERE id = ?`,
    )
    .bind(b.status ?? null, b.status ?? "", b.id)
    .run();
  return NextResponse.json({ ok: true });
}

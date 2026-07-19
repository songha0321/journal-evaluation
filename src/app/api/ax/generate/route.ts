import { NextResponse } from "next/server";
import { assembleOriginal } from "@/lib/ax";
import { queryOne } from "@/lib/db";
import { reviseText, makeComment, makeSubtitle, aiEnabled } from "@/lib/ai";

// AI 생성: 탈고 / comment / 소제목. authorId로 원문을 조립해 처리.
export async function POST(req: Request) {
  const b = (await req.json()) as { kind: "revise" | "comment" | "subtitle"; author_id: string; text?: string };
  if (!b.author_id || !b.kind) return NextResponse.json({ error: "kind, author_id 필요" }, { status: 400 });

  const base = b.text && b.text.trim() ? b.text : await assembleOriginal(b.author_id);
  if (!base.trim()) return NextResponse.json({ error: "원문이 없습니다" }, { status: 404 });

  if (b.kind === "revise") {
    const { result, ai } = await reviseText(base);
    return NextResponse.json({ result, ai });
  }
  if (b.kind === "subtitle") {
    const { result, ai } = await makeSubtitle(base);
    return NextResponse.json({ result, ai });
  }
  // comment
  const meta = await queryOne<{ name: string; final_university: string | null }>(
    `SELECT name, final_university FROM authors WHERE id = ?`,
    [b.author_id],
  );
  const { result, ai } = await makeComment(base, meta?.name ?? "학생", meta?.final_university ?? "");
  return NextResponse.json({ result, ai });
}

export async function GET() {
  return NextResponse.json({ ai_enabled: await aiEnabled() });
}

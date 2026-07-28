import { NextResponse } from "next/server";
import { getManuscript } from "@/lib/ax";
import { reviseText, makeComment, makeSubtitle, aiEnabled } from "@/lib/ai";

/**
 * AI 생성: 탈고 / comment / 소제목.
 * 원문은 확정된 qna 행의 answer_text 하나다(작성자의 답변 전체를 이어붙이지 않는다).
 */
export async function POST(req: Request) {
  const b = (await req.json()) as {
    kind: "revise" | "comment" | "subtitle";
    ms_id: string;
    /** 편집자가 화면에서 고친 텍스트가 있으면 그것을 기준으로 생성 */
    text?: string;
  };
  if (!b.ms_id || !b.kind) return NextResponse.json({ error: "kind, ms_id 필요" }, { status: 400 });

  const ms = await getManuscript(b.ms_id);
  if (!ms) return NextResponse.json({ error: "원고를 찾을 수 없습니다." }, { status: 404 });

  const base = b.text?.trim() ? b.text : (ms.answer_text ?? "");
  if (!base.trim()) return NextResponse.json({ error: "원문이 없습니다." }, { status: 404 });

  if (b.kind === "revise") return NextResponse.json(await reviseText(base));
  if (b.kind === "subtitle") return NextResponse.json(await makeSubtitle(base));
  return NextResponse.json(await makeComment(base, ms.name ?? "학생", ms.final_university ?? ""));
}

export async function GET() {
  return NextResponse.json({ ai_enabled: await aiEnabled() });
}

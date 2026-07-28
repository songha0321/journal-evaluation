import { NextResponse } from "next/server";
import { shortlistToc } from "@/lib/selection";

export const maxDuration = 300;

/** 목차 1건에 대해 AI 수기 선별을 실행한다. 클라이언트가 목차를 순차 호출해 진행률을 만든다. */
export async function POST(req: Request) {
  const b = (await req.json()) as { toc_id?: string };
  if (!b.toc_id) return NextResponse.json({ error: "toc_id 필요" }, { status: 400 });
  try {
    return NextResponse.json(await shortlistToc(b.toc_id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "선별 실패" }, { status: 500 });
  }
}

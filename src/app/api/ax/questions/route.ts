import { NextResponse } from "next/server";
import { listQuestions } from "@/lib/ax";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cohort = Number(searchParams.get("cohort"));
  if (!cohort) return NextResponse.json({ error: "cohort 필요" }, { status: 400 });
  const rows = await listQuestions(cohort);
  return NextResponse.json({ questions: rows });
}

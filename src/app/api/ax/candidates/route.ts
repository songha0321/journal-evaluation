import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/ax";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cohort = Number(searchParams.get("cohort"));
  const type = searchParams.get("type") || undefined;
  if (!cohort) return NextResponse.json({ error: "cohort 필요" }, { status: 400 });
  const rows = await listCandidates(cohort, type);
  return NextResponse.json({ candidates: rows });
}

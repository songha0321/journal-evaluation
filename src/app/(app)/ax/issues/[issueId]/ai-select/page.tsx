import { listTocsByIssue, listCandidatesByToc, listManuscriptsByToc, type Candidate } from "@/lib/ax";
import { SelectBoard } from "@/components/ax/SelectBoard";

export const dynamic = "force-dynamic";

export default async function AiSelectPage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const tocs = await listTocsByIssue(issueId);

  // 후보는 편집자가 요청한 개수만큼만 노출한다(SELECTION.md §3.3).
  // 초과분은 ax_candidate에 남아 있다가, 후보를 제외하면 다음 순위가 채워진다.
  const pairs = await Promise.all(
    tocs.map(async (t) => {
      const [cands, mss] = await Promise.all([
        listCandidatesByToc(t.id, t.select_count),
        listManuscriptsByToc(t.id),
      ]);
      return [t.id, cands, mss.map((m) => m.qna_id)] as const;
    }),
  );

  const candidates: Record<string, Candidate[]> = {};
  const confirmed: Record<string, string[]> = {};
  for (const [id, cands, qnaIds] of pairs) {
    candidates[id] = cands;
    confirmed[id] = qnaIds;
  }

  return <SelectBoard issueId={issueId} tocs={tocs} candidates={candidates} confirmed={confirmed} />;
}

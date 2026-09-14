import { listIssues, listAllTocs, type Toc } from "@/lib/ax";
import { issueProgress, issueStages } from "@/lib/ax-progress";
import { DataTable } from "@/components/ui/DataTable";
import { AddIssueButton } from "@/components/ax/AddIssueButton";

export const dynamic = "force-dynamic";

export default async function EditingIssuesPage() {
  const [issues, allTocs] = await Promise.all([listIssues("editing"), listAllTocs()]);
  const byIssue = new Map<string, Toc[]>();
  for (const t of allTocs) {
    const list = byIssue.get(t.issue_id) ?? [];
    list.push(t);
    byIssue.set(t.issue_id, list);
  }

  const rows = issues.map((issue) => {
    const tocs = byIssue.get(issue.id) ?? [];
    const prog = issueProgress(tocs);
    return {
      id: issue.id,
      project: issue.project,
      issue_label: issue.issue_label,
      cohort: issue.cohort ?? null,
      cohort_label: issue.cohort ? `${issue.cohort}기` : "-",
      toc_count: tocs.length,
      ms_count: issue.ms_count ?? 0,
      pct: prog.pct,
      pct_warn: prog.needsReview > 0,
      stage: tocs.length ? issueProgressCurrentLabel(tocs) : "목차 입력",
      go: "이동하기",
      go_href: `/ax/issues/${issue.id}`,
    };
  });

  return (
    <>
      <div className="page-header">
        <div className="actions">
          <AddIssueButton />
        </div>
        <div>
          <h1>편집 중 항해일지</h1>
          <p className="desc">호차를 선택해 목차 입력부터 원고 EXPORT까지 진행합니다.</p>
        </div>
      </div>

      <div className="page-body">
        <DataTable
          rowKey="id"
          rows={rows}
          empty="편집 중인 호차가 없습니다. ‘호차 추가’로 시작하세요."
          columns={[
            { key: "project", label: "프로젝트", type: "muted", width: 130 },
            { key: "issue_label", label: "호차", type: "strong", width: 110 },
            { key: "cohort_label", label: "대상 기수", sortKey: "cohort", width: 90 },
            { key: "toc_count", label: "목차", type: "number", width: 70 },
            { key: "ms_count", label: "확정 수기", type: "number", width: 90 },
            { key: "pct", label: "제작 진행률", type: "progress", width: 220 },
            { key: "stage", label: "현재 단계", type: "muted" },
            { key: "go", label: "", type: "btn-link", width: 110 },
          ]}
        />
      </div>
    </>
  );
}

/** 호차의 현재 단계 = 아직 끝나지 않은 가장 낮은 단계 (모든 목차 기준) */
function issueProgressCurrentLabel(tocs: Toc[]): string {
  const open = issueStages(tocs).find((s) => !s.done);
  return open ? open.label : "완료";
}

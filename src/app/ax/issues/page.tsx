import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listIssues, listAllTocs, type Toc } from "@/lib/ax";
import { issueProgress, issueStages } from "@/lib/ax-progress";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
        {issues.length === 0 ? (
          <div className="empty">편집 중인 호차가 없습니다. ‘호차 추가’로 시작하세요.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>프로젝트</th>
                  <th>호차</th>
                  <th>대상 기수</th>
                  <th className="num">목차</th>
                  <th className="num">확정 수기</th>
                  <th style={{ width: 200 }}>제작 진행률</th>
                  <th>현재 단계</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => {
                  const tocs = byIssue.get(issue.id) ?? [];
                  const prog = issueProgress(tocs);
                  const firstOpen = tocs.length
                    ? issueProgressCurrentLabel(tocs)
                    : "목차 입력";
                  return (
                    <tr key={issue.id}>
                      <td className="muted">{issue.project}</td>
                      <td style={{ fontWeight: 600 }}>{issue.issue_label}</td>
                      <td>{issue.cohort ? `${issue.cohort}기` : "-"}</td>
                      <td className="num">{tocs.length}</td>
                      <td className="num">{issue.ms_count ?? 0}</td>
                      <td>
                        <ProgressBar pct={prog.pct} warn={prog.needsReview > 0} />
                      </td>
                      <td className="muted">{firstOpen}</td>
                      <td>
                        <Link className="btn" href={`/ax/issues/${issue.id}`}>
                          이동하기
                          <ArrowRight size={14} strokeWidth={2} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** 호차의 현재 단계 = 아직 끝나지 않은 가장 낮은 단계 (모든 목차 기준) */
function issueProgressCurrentLabel(tocs: Toc[]): string {
  const open = issueStages(tocs).find((s) => !s.done);
  return open ? open.label : "완료";
}

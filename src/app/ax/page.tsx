import Link from "next/link";
import { ArrowRight, BellRing, TriangleAlert } from "lucide-react";
import { listIssues, listAllTocs, tocLabel, type Toc } from "@/lib/ax";
import { tocProgress, issueProgress, issueFunnel } from "@/lib/ax-progress";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const dynamic = "force-dynamic";

export default async function ManuscriptDashboard() {
  const [issues, allTocs] = await Promise.all([listIssues("editing"), listAllTocs()]);
  const byIssue = new Map<string, Toc[]>();
  for (const t of allTocs) {
    const list = byIssue.get(t.issue_id) ?? [];
    list.push(t);
    byIssue.set(t.issue_id, list);
  }

  // 알림: AI 선별은 끝났는데 편집자 확정이 안 된 목차 → 클릭 시 [AI 수기 선별]로 이동
  const awaitingPick = allTocs.filter((t) => t.shortlisted_at && (t.ms_count ?? 0) < t.select_count);
  const needsReview = allTocs.reduce((s, t) => s + (t.needs_review_count ?? 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>원고 대시보드</h1>
          <p className="desc">편집 중인 항해일지의 제작 진행 상황</p>
        </div>
      </div>

      <div className="page-body">
        {awaitingPick.length > 0 && (
          <Link
            className="alert info"
            href={`/ax/issues/${awaitingPick[0].issue_id}/ai-select`}
            style={{ textDecoration: "none" }}
          >
            <BellRing size={16} strokeWidth={1.75} aria-hidden />
            AI 수기 선별이 완료된 목차가 {awaitingPick.length}개 있습니다. 편집자 확정이 필요합니다.
            <ArrowRight size={14} strokeWidth={2} style={{ marginLeft: "auto" }} aria-hidden />
          </Link>
        )}
        {needsReview > 0 && (
          <div className="alert warn">
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
            검수 필요로 표시된 원고가 {needsReview}건 있습니다. 확정 전에 확인하세요.
          </div>
        )}

        {issues.length === 0 ? (
          <div className="empty">편집 중인 항해일지가 없습니다.</div>
        ) : (
          <div className="issue-grid">
            {issues.map((issue) => {
              const tocs = byIssue.get(issue.id) ?? [];
              const prog = issueProgress(tocs);
              const funnel = issueFunnel(tocs);
              return (
                <div key={issue.id} className="issue-card">
                  <div className="ic-head">
                    <div>
                      <div className="ic-project">{issue.project}</div>
                      <h3>{issue.issue_label}</h3>
                    </div>
                    <Link className="btn" href={`/ax/issues/${issue.id}`}>
                      이동하기
                      <ArrowRight size={14} strokeWidth={2} aria-hidden />
                    </Link>
                  </div>

                  <div>
                    <div className="faint" style={{ fontSize: 12, marginBottom: 5 }}>
                      제작 진행률
                    </div>
                    <ProgressBar pct={prog.pct} warn={prog.needsReview > 0} />
                  </div>

                  <div className="ic-stats">
                    <div>
                      목차<b>{tocs.length}</b>
                    </div>
                    <div>
                      확정 수기<b>{funnel.confirmed}</b>
                    </div>
                    <div>
                      탈고<b>{funnel.revised}</b>
                    </div>
                    <div>
                      원고 확정<b>{funnel.finalized}</b>
                    </div>
                  </div>

                  {tocs.length > 0 && (
                    <div className="ic-toc">
                      {tocs.map((t) => {
                        const p = tocProgress(t);
                        return (
                          <div key={t.id} className="ic-toc-row">
                            <span className="t">{tocLabel(t)}</span>
                            <span className="faint" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                              {p.current ? p.current.label : "완료"}
                            </span>
                            <span style={{ width: 76, flexShrink: 0 }}>
                              <ProgressBar pct={p.pct} warn={p.needsReview > 0} showPct={false} />
                            </span>
                            <span
                              className="faint"
                              style={{ fontSize: 11, width: 30, textAlign: "right", flexShrink: 0 }}
                            >
                              {p.pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

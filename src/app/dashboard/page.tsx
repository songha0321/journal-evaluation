import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getTotals,
  getCohortCounts,
  getCohortFees,
  getSubmissionStatusRollup,
  getArticleStatusRollup,
  getAiSuspicionRollup,
} from "@/lib/queries/dashboard";
import { cohortLabel, formatWon } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totals, cohorts, fees, subRoll, artRoll, suspRoll] = await Promise.all([
    getTotals(),
    getCohortCounts(),
    getCohortFees(),
    getSubmissionStatusRollup(),
    getArticleStatusRollup(),
    getAiSuspicionRollup(),
  ]);

  const feeByCohort = new Map(fees.map((f) => [f.cohort, f]));
  const totalFee = fees.reduce((s, f) => s + f.total_fee, 0);

  return (
    <>
      <PageHeader title="대시보드" desc="항해일지 수기·평가·용역비 현황" />
      <div className="page-body">
        <div className="stat-grid">
          <StatCard label="작성자(수기)" value={totals.authors} />
          <StatCard label="질의응답" value={totals.qna} />
          <StatCard label="평가" value={totals.evaluations} />
          <StatCard label="원고" value={totals.articles} sub="작성 대기" />
          <StatCard label="총 용역비" value={formatWon(totalFee)} sub="person 단위" />
        </div>

        <div className="section-title">기수별 현황</div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>기수</th>
                <th className="num">작성자</th>
                <th className="num">질의응답</th>
                <th className="num">평가</th>
                <th className="num">용역비 적용</th>
                <th className="num">용역비 합계</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const f = feeByCohort.get(c.cohort);
                return (
                  <tr key={c.cohort}>
                    <td>{cohortLabel(c.cohort)}</td>
                    <td className="num">{c.authors.toLocaleString("ko-KR")}</td>
                    <td className="num">{c.qna.toLocaleString("ko-KR")}</td>
                    <td className="num">{c.evaluations.toLocaleString("ko-KR")}</td>
                    <td className="num">{f ? `${f.fee_authors}명` : "-"}</td>
                    <td className="num">{f ? formatWon(f.total_fee) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="section-title">상태 롤업</div>
        <div className="stat-grid">
          <div className="card">
            <div className="label muted" style={{ marginBottom: 8 }}>
              제출 상태
            </div>
            {subRoll.map((s) => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <StatusBadge value={s.label} kind="submission" />
                <span className="num">{s.n}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="label muted" style={{ marginBottom: 8 }}>
              원고 상태
            </div>
            {artRoll.length ? (
              artRoll.map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <StatusBadge value={s.label} kind="article" />
                  <span className="num">{s.n}</span>
                </div>
              ))
            ) : (
              <span className="faint">원고 없음</span>
            )}
          </div>
          <div className="card">
            <div className="label muted" style={{ marginBottom: 8 }}>
              AI 의심
            </div>
            {suspRoll.length ? (
              suspRoll.map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <StatusBadge value={s.label} kind="suspicion" />
                  <span className="num">{s.n}</span>
                </div>
              ))
            ) : (
              <span className="faint">데이터 없음</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

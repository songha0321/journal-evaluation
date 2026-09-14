import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import {
  getTotals,
  getCohortCounts,
  getCohortFees,
  getSubmissionStatusRollup,
  getArticleStatusRollup,
  getAiSuspicionRollup,
} from "@/lib/queries/dashboard";
import { getCohortReadiness } from "@/lib/queries/data";
import { cohortLabel, formatWon } from "@/lib/format";

import { getCurrentUser, isAdmin } from "@/lib/auth";
import { Locked } from "@/components/ui/Locked";

export const dynamic = "force-dynamic";

export default async function DataDashboardPage() {
  if (!isAdmin(await getCurrentUser())) return <Locked title="데이터 대시보드" />;
  const [totals, cohorts, fees, subRoll, artRoll, suspRoll, readiness] = await Promise.all([
    getTotals(),
    getCohortCounts(),
    getCohortFees(),
    getSubmissionStatusRollup(),
    getArticleStatusRollup(),
    getAiSuspicionRollup(),
    getCohortReadiness(),
  ]);

  const feeByCohort = new Map(fees.map((f) => [f.cohort, f]));
  const totalFee = fees.reduce((s, f) => s + f.total_fee, 0);

  const readyRows = readiness.map((r) => ({
    ...r,
    cohort_label: cohortLabel(r.cohort),
    pct: r.authors ? Math.round((r.evaluated / r.authors) * 100) : 0,
  }));
  const countRows = cohorts.map((c) => {
    const f = feeByCohort.get(c.cohort);
    return {
      ...c,
      cohort_label: cohortLabel(c.cohort),
      fee_authors: f?.fee_authors ?? 0,
      total_fee: f?.total_fee ?? 0,
    };
  });

  return (
    <>
      <PageHeader title="데이터 대시보드" desc="수기 풀 준비 현황 (PROCESS.md 트랙 A: 수집, AI 평가, 선별 판정)과 용역비" />
      <div className="page-body">
        <div className="stat-grid">
          <StatCard label="작성자(수기)" value={totals.authors} />
          <StatCard label="질의응답" value={totals.qna} />
          <StatCard label="평가" value={totals.evaluations} />
          <StatCard label="게재 원고" value={totals.articles} sub="역대 항해일지" />
          <StatCard label="총 용역비" value={formatWon(totalFee)} sub="person 단위" />
        </div>

        <div className="section-title">기수별 준비율</div>
        <DataTable
          rowKey="cohort"
          rows={readyRows}
          defaultSort={{ key: "cohort_label", dir: "asc" }}
          columns={[
            { key: "cohort_label", label: "기수", sortKey: "cohort", width: 90 },
            { key: "authors", label: "작성자", type: "number" },
            { key: "submissions", label: "제출", type: "number" },
            { key: "evaluated", label: "AI 평가", type: "number" },
            { key: "selected", label: "선별", type: "number" },
            { key: "pct", label: "준비율 (평가 완료 / 작성자)", type: "progress", width: 220 },
          ]}
        />

        <div className="section-title">기수별 현황</div>
        <DataTable
          rowKey="cohort"
          rows={countRows}
          defaultSort={{ key: "cohort_label", dir: "asc" }}
          columns={[
            { key: "cohort_label", label: "기수", sortKey: "cohort", width: 90 },
            { key: "authors", label: "작성자", type: "number" },
            { key: "qna", label: "질의응답", type: "number" },
            { key: "evaluations", label: "평가", type: "number" },
            { key: "fee_authors", label: "용역비 적용(명)", type: "number" },
            { key: "total_fee", label: "용역비 합계", type: "won" },
          ]}
        />

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

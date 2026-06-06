import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/table/FilterBar";
import { EmptyState } from "@/components/table/EmptyState";
import { EvaluationSelectionTable } from "@/components/EvaluationSelectionTable";
import { StubButton } from "@/components/StubButton";
import { listEvaluations, getEvaluationCohorts } from "@/lib/queries/evaluations";
import { cohortLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cohort = sp.cohort ? Number(sp.cohort) : undefined;

  const [rows, cohorts] = await Promise.all([listEvaluations(cohort), getEvaluationCohorts()]);

  return (
    <>
      <PageHeader
        title="평가 · 선별"
        desc="평가 점수 기준 후보 비교 및 최종 선별 (4점 이상 자동 선별)"
        actions={
          <>
            <StubButton label="자연어 선별 요청" note="자연어 조건 추출 + AI 선별은 다음 차수에서 제공됩니다." />
            <StubButton label="AI 평가 실행" primary note="AI 평가(0~5점·선별·사유)는 다음 차수에서 제공됩니다." />
          </>
        }
      />
      <div className="page-body">
        <FilterBar
          selects={[
            {
              key: "cohort",
              label: "기수",
              options: cohorts.map((c) => ({ value: String(c), label: cohortLabel(c) })),
            },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState message="평가 내역이 없습니다." />
        ) : (
          <EvaluationSelectionTable rows={rows} />
        )}
      </div>
    </>
  );
}

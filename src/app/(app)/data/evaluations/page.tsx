import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/table/FilterBar";
import { EvaluationSelectionTable } from "@/components/EvaluationSelectionTable";
import { listEvaluations, getEvaluationCohorts } from "@/lib/queries/evaluations";
import { cohortLabel } from "@/lib/format";

import { getCurrentUser, isAdmin } from "@/lib/auth";
import { Locked } from "@/components/ui/Locked";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isAdmin(await getCurrentUser())) return <Locked title="작성자 평가 DB" />;
  const sp = await searchParams;
  const cohort = sp.cohort ? Number(sp.cohort) : undefined;

  const [rows, cohorts] = await Promise.all([listEvaluations(cohort), getEvaluationCohorts()]);

  return (
    <>
      <PageHeader
        title="작성자 평가 DB"
        desc={`AI 평가 ${rows.length}건. 4점(80점) 이상이 선별 기준 (EVALUATION.md)`}
      />
      <div className="page-body">
        <FilterBar
          selects={[
            { key: "cohort", label: "기수", options: cohorts.map((c) => ({ value: String(c), label: cohortLabel(c) })), width: 120 },
          ]}
        />
        <EvaluationSelectionTable rows={rows} />
      </div>
    </>
  );
}

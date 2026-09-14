import { DataTable } from "@/components/ui/DataTable";
import type { EvaluationRow } from "@/lib/queries/evaluations";
import { cohortLabel } from "@/lib/format";

/** 작성자 평가 비교표. 선별 여부는 4점(80점) 기준(EVALUATION.md)이며 여기서는 열람만 한다. */
export function EvaluationSelectionTable({ rows }: { rows: EvaluationRow[] }) {
  const tableRows = rows.map((r) => ({
    ...r,
    name_href: `/data/authors/${r.author_id}`,
    cohort_label: cohortLabel(r.cohort),
    total_score_sel: r.total_score,
  }));
  return (
    <DataTable
      rowKey="evaluation_id"
      rows={tableRows}
      empty="평가 내역이 없습니다."
      defaultSort={{ key: "total_score", dir: "desc" }}
      columns={[
        { key: "name", label: "이름", type: "link", width: 110 },
        { key: "cohort_label", label: "기수", sortKey: "cohort", width: 70 },
        { key: "student_type", label: "유형", width: 90 },
        { key: "final_university", label: "최종대학", type: "clip", maxWidth: 200 },
        { key: "total_score", label: "점수", type: "score", width: 80, align: "right" },
        { key: "total_score_sel", label: "선별", type: "select", sortKey: "total_score", width: 70 },
        { key: "ai_suspicion_level", label: "AI 의심", type: "badge", badgeKind: "suspicion", width: 90 },
        { key: "evaluation_summary", label: "평가 사유", type: "clip", flex: true },
        { key: "scholarship_amount", label: "용역비", type: "won", width: 120 },
      ]}
    />
  );
}

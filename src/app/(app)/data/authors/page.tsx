import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/table/FilterBar";
import { DataTable } from "@/components/ui/DataTable";
import { listEssays, getEssayFilterOptions, type EssayFilters } from "@/lib/queries/essays";
import { cohortLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuthorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters: EssayFilters = {
    cohort: sp.cohort ? Number(sp.cohort) : undefined,
    studentType: sp.studentType || undefined,
    university: sp.university || undefined,
    minScore: sp.minScore ? Number(sp.minScore) : undefined,
    q: sp.q || undefined,
  };

  const [rows, options] = await Promise.all([listEssays(filters), getEssayFilterOptions()]);
  const tableRows = rows.map((r) => ({
    ...r,
    name_href: `/data/authors/${r.id}`,
    cohort_label: cohortLabel(r.cohort),
  }));

  return (
    <>
      <PageHeader title="작성자 DB" desc={`작성자 ${rows.length}명 (최대 300). 이름을 누르면 수기 원문과 평가를 볼 수 있습니다`} />
      <div className="page-body">
        <FilterBar
          selects={[
            { key: "cohort", label: "기수", options: options.cohorts.map((c) => ({ value: String(c), label: cohortLabel(c) })), width: 120 },
            { key: "studentType", label: "유형", options: options.studentTypes.map((t) => ({ value: t, label: t })), width: 130 },
            {
              key: "minScore",
              label: "점수",
              width: 130,
              options: [
                { value: "80", label: "4점 이상" },
                { value: "60", label: "3점 이상" },
                { value: "40", label: "2점 이상" },
              ],
            },
          ]}
          texts={[
            { key: "q", label: "이름", placeholder: "이름으로 검색", width: 200 },
            { key: "university", label: "대학", placeholder: "최종대학으로 검색", width: 220 },
          ]}
        />
        <DataTable
          rowKey="id"
          rows={tableRows}
          empty="조건에 맞는 작성자가 없습니다."
          columns={[
            { key: "name", label: "이름", type: "link", width: 110 },
            { key: "cohort_label", label: "기수", sortKey: "cohort", width: 70 },
            { key: "student_type", label: "유형", width: 90 },
            { key: "final_university", label: "최종대학", type: "clip", maxWidth: 220 },
            { key: "qna_count", label: "문항", type: "number", width: 70 },
            { key: "total_score", label: "점수", type: "score", width: 80, align: "right" },
            { key: "submission_status", label: "제출", type: "badge", badgeKind: "submission", width: 90 },
            { key: "ai_suspicion_level", label: "AI 의심", type: "badge", badgeKind: "suspicion", width: 90 },
            { key: "scholarship_amount", label: "용역비", type: "won", width: 120 },
          ]}
        />
      </div>
    </>
  );
}

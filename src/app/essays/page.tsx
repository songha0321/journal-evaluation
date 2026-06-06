import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/table/FilterBar";
import { EmptyState } from "@/components/table/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBadge } from "@/components/ScoreBadge";
import { StubButton } from "@/components/StubButton";
import { listEssays, getEssayFilterOptions, type EssayFilters } from "@/lib/queries/essays";
import { cohortLabel, formatWon } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EssaysPage({
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

  return (
    <>
      <PageHeader
        title="수기 DB"
        desc={`작성자 ${rows.length}명 (최대 300)`}
        actions={<StubButton label="수기 업로드" note="docx/xlsx 업로드 + 필드 매핑은 다음 차수에서 제공됩니다." />}
      />
      <div className="page-body">
        <FilterBar
          selects={[
            {
              key: "cohort",
              label: "기수",
              options: options.cohorts.map((c) => ({ value: String(c), label: cohortLabel(c) })),
            },
            {
              key: "studentType",
              label: "유형",
              options: options.studentTypes.map((t) => ({ value: t, label: t })),
            },
            {
              key: "minScore",
              label: "최소점수",
              options: [
                { value: "80", label: "4점 이상" },
                { value: "60", label: "3점 이상" },
                { value: "40", label: "2점 이상" },
              ],
            },
          ]}
          texts={[
            { key: "q", label: "이름", placeholder: "이름 검색 (Enter)" },
            { key: "university", label: "대학", placeholder: "대학 검색 (Enter)" },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState message="조건에 맞는 수기가 없습니다." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>기수</th>
                  <th>유형</th>
                  <th>최종대학</th>
                  <th className="num">문항</th>
                  <th className="num">점수</th>
                  <th>제출</th>
                  <th>AI 의심</th>
                  <th className="num">용역비</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/essays/${r.id}`} className="row-link">
                        {r.name}
                      </Link>
                    </td>
                    <td>{cohortLabel(r.cohort)}</td>
                    <td>{r.student_type ?? "-"}</td>
                    <td>{r.final_university ?? "-"}</td>
                    <td className="num">{r.qna_count}</td>
                    <td className="num">
                      <ScoreBadge totalScore={r.total_score} />
                    </td>
                    <td>
                      <StatusBadge value={r.submission_status} kind="submission" />
                    </td>
                    <td>
                      <StatusBadge value={r.ai_suspicion_level} kind="suspicion" />
                    </td>
                    <td className="num">{formatWon(r.scholarship_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

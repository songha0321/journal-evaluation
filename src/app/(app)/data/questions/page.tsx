import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/table/FilterBar";
import { DataTable } from "@/components/ui/DataTable";
import { listQuestions, listCohorts } from "@/lib/queries/data";
import { cohortLabel } from "@/lib/format";

import { getCurrentUser, isAdmin } from "@/lib/auth";
import { Locked } from "@/components/ui/Locked";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isAdmin(await getCurrentUser())) return <Locked title="수기 질문지 DB" />;
  const sp = await searchParams;
  const cohort = sp.cohort ? Number(sp.cohort) : undefined;
  const [rows, cohorts] = await Promise.all([listQuestions(cohort), listCohorts()]);
  const tableRows = rows.map((q) => ({
    ...q,
    cohort_label: cohortLabel(q.cohort),
    question_text_href: `/data/qna?cohort=${q.cohort}&question=${q.id}`,
    avg_len: q.avg_len != null ? Math.round(q.avg_len) : null,
    state: q.is_active ? "활성" : "비활성",
  }));

  return (
    <>
      <PageHeader
        title="수기 질문지 DB"
        desc={`질문 ${rows.length}개. 기수마다 질문지가 다르며, 기수 간 같은 질문은 key로 묶습니다. 질문을 누르면 답변 목록으로 갑니다`}
      />
      <div className="page-body">
        <FilterBar
          selects={[
            { key: "cohort", label: "기수", options: cohorts.map((c) => ({ value: String(c), label: cohortLabel(c) })), width: 120 },
          ]}
        />
        <DataTable
          rowKey="id"
          rows={tableRows}
          empty="질문이 없습니다. 5기는 파일 제출만 받아 질문지가 없습니다."
          defaultSort={{ key: "cohort_label", dir: "asc" }}
          columns={[
            { key: "cohort_label", label: "기수", sortKey: "cohort", width: 60 },
            { key: "sort_order", label: "순서", type: "number", width: 60 },
            { key: "question_key", label: "key", type: "muted", width: 70 },
            { key: "question_text", label: "질문", type: "link", flex: true },
            { key: "category", label: "분류", width: 110 },
            { key: "answers", label: "답변 수", type: "number", width: 80 },
            { key: "avg_len", label: "평균 글자", type: "number", width: 90 },
            { key: "state", label: "상태", width: 70 },
          ]}
        />
      </div>
    </>
  );
}

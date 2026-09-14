import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/table/FilterBar";
import { DataTable } from "@/components/ui/DataTable";
import { cookies } from "next/headers";
import { listQna, listQuestionOptions, listCohorts } from "@/lib/queries/data";
import { parseSettingsCookie, SETTINGS_KEY } from "@/lib/settings";
import { cohortLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function oneLine(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export default async function QnaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cohort = sp.cohort ? Number(sp.cohort) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = parseSettingsCookie((await cookies()).get(SETTINGS_KEY)?.value).qnaPageSize;
  const filters = { cohort, questionId: sp.question || undefined, q: sp.q || undefined, page, pageSize };

  const [{ rows, total }, questions, cohorts] = await Promise.all([
    listQna(filters),
    listQuestionOptions(cohort),
    listCohorts(),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") next.set(k, v);
    next.set("page", String(p));
    return `/data/qna?${next}`;
  };
  const tableRows = rows.map((r) => ({
    ...r,
    name_href: `/data/authors/${r.author_id}`,
    cohort_label: cohortLabel(r.cohort),
    question: `${r.category ? `[${r.category}] ` : ""}${oneLine(r.question_text)}`,
    answer: oneLine(r.answer_text),
  }));

  return (
    <>
      <PageHeader
        title="수기 DB"
        desc={`답변 ${total.toLocaleString("ko-KR")}건. 한 화면에 ${pageSize}건씩, 정렬은 현재 화면 안에서만 적용됩니다`}
      />
      <div className="page-body">
        <FilterBar
          selects={[
            { key: "cohort", label: "기수", options: cohorts.map((c) => ({ value: String(c), label: cohortLabel(c) })), width: 120 },
            {
              key: "question",
              label: "질문",
              width: 360,
              options: questions.map((q) => ({
                value: q.id,
                label: `${cohortLabel(q.cohort)} ${q.sort_order}. ${oneLine(q.question_text)}`,
              })),
            },
          ]}
          texts={[{ key: "q", label: "검색", placeholder: "답변 본문이나 작성자 이름으로 검색", width: 300 }]}
        />
        <DataTable
          rowKey="id"
          rows={tableRows}
          empty="조건에 맞는 답변이 없습니다."
          columns={[
            { key: "name", label: "작성자", type: "link", width: 90 },
            { key: "student_type", label: "유형", width: 80 },
            { key: "cohort_label", label: "기수", sortKey: "cohort", width: 60 },
            { key: "question", label: "질문", type: "clip", maxWidth: 240 },
            { key: "answer", label: "답변", type: "clip", flex: true },
            { key: "answer_len", label: "글자", type: "number", width: 70 },
          ]}
        />
        {pages > 1 && (
          <div className="toolbar" style={{ marginTop: 14, justifyContent: "space-between" }}>
            {page > 1 ? <Link className="btn" href={pageHref(page - 1)}>이전</Link> : <span />}
            <span className="muted">
              {page} / {pages}
            </span>
            {page < pages ? <Link className="btn" href={pageHref(page + 1)}>다음</Link> : <span />}
          </div>
        )}
      </div>
    </>
  );
}

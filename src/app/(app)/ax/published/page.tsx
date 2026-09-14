import { DataTable } from "@/components/ui/DataTable";
import { listPublishedIssues } from "@/lib/queries/published";

export const dynamic = "force-dynamic";

export default async function PublishedIssuesPage() {
  const issues = await listPublishedIssues();
  const rows = issues.map((i) => ({
    id: i.id,
    project: i.project,
    issue_label: i.issue_label,
    sort_order: i.sort_order,
    cohort: i.cohort,
    cohort_label: i.cohort ? `${i.cohort}기` : "-",
    article_count: i.article_count,
    published_at: i.published_at ? i.published_at.slice(0, 10) : "-",
    go: "원고 보기",
    go_href: `/ax/published/${i.id}`,
  }));

  return (
    <>
      <div className="page-header">
        <h1>편집 완료 항해일지</h1>
        <p className="desc">발행된 호차와 실제 게재된 원고(articles). 새 원고의 소제목과 comment 톤은 여기 실린 글을 기준으로 삼습니다.</p>
      </div>
      <div className="page-body">
        <DataTable
          rowKey="id"
          rows={rows}
          empty="발행된 호차가 없습니다."
          defaultSort={{ key: "project", dir: "desc" }}
          columns={[
            { key: "project", label: "프로젝트", width: 150 },
            { key: "issue_label", label: "호차", type: "strong", sortKey: "sort_order", width: 110 },
            { key: "cohort_label", label: "대상 기수", sortKey: "cohort", width: 90 },
            { key: "article_count", label: "게재 원고", type: "number", width: 100 },
            { key: "published_at", label: "발행일", type: "muted", width: 120 },
            { key: "go", label: "", type: "btn-link", width: 110 },
          ]}
        />
      </div>
    </>
  );
}

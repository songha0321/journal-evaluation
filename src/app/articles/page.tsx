import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/table/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { listArticles } from "@/lib/queries/articles";
import { cohortLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const rows = await listArticles();
  const hasArticles = rows.some((r) => r.id);

  return (
    <>
      <PageHeader
        title="원고"
        desc={hasArticles ? `원고 ${rows.length}건` : "원고 대상 후보 (선별 4점 이상) — 원고 미작성"}
      />
      <div className="page-body">
        {rows.length === 0 ? (
          <EmptyState message="원고 대상이 없습니다." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>기수</th>
                  <th>제목</th>
                  <th>상태</th>
                  <th>편집자</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.author_id}>
                    <td>
                      <Link href={`/articles/${r.author_id}`} className="row-link">
                        {r.name}
                      </Link>
                    </td>
                    <td>{cohortLabel(r.cohort)}</td>
                    <td>{r.title ?? <span className="faint">미작성</span>}</td>
                    <td>
                      <StatusBadge value={r.article_status} kind="article" />
                    </td>
                    <td>{r.editor_name ?? "-"}</td>
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

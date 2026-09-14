import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue } from "@/lib/ax";
import { getArticle } from "@/lib/queries/published";
import { Hero } from "@/components/ui/Hero";

export const dynamic = "force-dynamic";

export default async function PublishedArticlePage({
  params,
}: {
  params: Promise<{ issueId: string; articleId: string }>;
}) {
  const { issueId, articleId } = await params;
  const [issue, article] = await Promise.all([getIssue(issueId), getArticle(articleId)]);
  if (!issue || !article) notFound();

  const where = [
    article.part_no != null ? `Part ${article.part_no}` : null,
    article.chapter_no != null ? `Chapter ${article.chapter_no}` : null,
    article.part_title,
    article.section,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Hero
        back={{ href: `/ax/published/${issueId}`, label: `${issue.project} ${issue.issue_label}` }}
        title={article.subtitle || article.title || "(소제목 없음)"}
        meta={
          <>
            {where && <span className="muted">{where}</span>}
            <span>{[article.author_name, article.hall, article.class_name].filter(Boolean).join(" ")}</span>
            {article.university && <span>{article.university}</span>}
            {article.epithet && <span className="muted">{article.epithet}</span>}
            {article.char_count != null && <span>{article.char_count.toLocaleString("ko-KR")}자</span>}
            {article.qna_id && (
              <Link href={`/data/authors/${article.author_id}`} className="tbl-link">
                원본 수기 보기
              </Link>
            )}
          </>
        }
      />
      <div className="page-body">
        <div className="article-grid">
          <article className="article-body">
            {article.final_content ? (
              <pre className="article-text">{article.final_content}</pre>
            ) : (
              <div className="empty">본문이 적재되지 않았습니다.</div>
            )}
          </article>
          <aside className="article-side">
            {article.hanmadi && (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}>목차 한마디</div>
                <p className="article-quote">{article.hanmadi}</p>
              </section>
            )}
            {article.comment && (
              <section>
                <div className="section-title">항해일지팀 comment</div>
                <p className="article-quote">{article.comment}</p>
              </section>
            )}
            <section>
              <div className="section-title">출처</div>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                {article.source_type ?? "-"}
                {article.source_file ? `, ${article.source_file}` : ""}
                {article.source_page != null ? `, p.${article.source_page}` : ""}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

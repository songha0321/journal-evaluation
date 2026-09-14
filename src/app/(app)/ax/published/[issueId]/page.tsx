import { notFound } from "next/navigation";
import { getIssue } from "@/lib/ax";
import { listArticlesByIssue } from "@/lib/queries/published";
import { IssueHero } from "@/components/ax/IssueHero";
import { DataTable } from "@/components/ui/DataTable";

export const dynamic = "force-dynamic";

export default async function PublishedIssuePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const issue = await getIssue(issueId);
  if (!issue) notFound();
  const articles = await listArticlesByIssue(issueId);
  const parts = new Set(articles.map((a) => a.part_no).filter((n) => n != null));

  const rows = articles.map((a) => ({
    ...a,
    part: a.part_no != null ? `Part ${a.part_no}` : "-",
    chapter: a.chapter_no != null ? `Ch. ${a.chapter_no}` : "-",
    where: [a.part_title, a.section].filter(Boolean).join(" / ") || "-",
    subtitle_text: a.subtitle || a.title || "",
    subtitle_text_href: `/ax/published/${issueId}/${a.id}`,
    student: [a.author_name, a.hall].filter(Boolean).join(" ") || "-",
    university: a.university || "-",
  }));

  return (
    <>
      <IssueHero issue={issue} back={{ href: "/ax/published", label: "편집 완료 항해일지" }}>
        <>
          <span>대상 기수 {issue.cohort ? `${issue.cohort}기` : "미지정"}</span>
          <span>Part {parts.size}개</span>
          <span>게재 원고 {articles.length}편</span>
          {issue.published_at && <span>발행 {issue.published_at.slice(0, 10)}</span>}
        </>
      </IssueHero>
      <div className="page-body">
        <DataTable
          rowKey="id"
          rows={rows}
          empty="이 호차에 적재된 게재 원고가 없습니다."
          columns={[
            { key: "part", label: "Part", sortKey: "part_no", width: 70 },
            { key: "chapter", label: "Chapter", sortKey: "chapter_no", width: 80 },
            { key: "where", label: "목차 / 구획", type: "clip", maxWidth: 220 },
            { key: "subtitle_text", label: "소제목", type: "link", flex: true },
            { key: "student", label: "학생", width: 130 },
            { key: "university", label: "진학", type: "clip", maxWidth: 160 },
            { key: "char_count", label: "글자", type: "number", width: 80 },
            { key: "source_type", label: "원본", type: "muted", width: 70 },
          ]}
        />
      </div>
    </>
  );
}

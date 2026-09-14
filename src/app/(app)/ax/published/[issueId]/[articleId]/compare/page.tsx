import { notFound, redirect } from "next/navigation";
import { getIssue } from "@/lib/ax";
import { getArticle } from "@/lib/queries/published";
import { findSourceCandidates, getQna, listEditComments, listEditLabels } from "@/lib/queries/compare";
import { getCurrentUser } from "@/lib/auth";
import { Hero } from "@/components/ui/Hero";
import { CompareView } from "@/components/ax/CompareView";

export const dynamic = "force-dynamic";

/**
 * 원문 비교. 탈고문 = 게재 원고 본문, 원문 = 같은 작성자의 qna 답변 중 가장 비슷한 것.
 * 정식 제작 프로세스의 단계가 아니라 탈고 규칙을 관찰하기 위한 화면이다.
 */
export default async function ComparePage({ params }: { params: Promise<{ issueId: string; articleId: string }> }) {
  const { issueId, articleId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [issue, article] = await Promise.all([getIssue(issueId), getArticle(articleId)]);
  if (!issue || !article) notFound();
  const finalText = article.final_content ?? "";

  let chosenIds: string[] = [];
  try {
    chosenIds = article.qna_ids_json ? (JSON.parse(article.qna_ids_json) as string[]) : article.qna_id ? [article.qna_id] : [];
  } catch {
    chosenIds = article.qna_id ? [article.qna_id] : [];
  }
  const [candidates, comments, labels] = await Promise.all([
    findSourceCandidates(articleId, article.author_id, article.author_name, finalText, 5),
    listEditComments(articleId),
    listEditLabels(articleId),
  ]);
  // 확정된 원문이 후보 밖이면 앞에 붙인다
  const missing = chosenIds.filter((id) => !candidates.some((c) => c.qna_id === id));
  const extra = (await Promise.all(missing.map((id) => getQna(id)))).filter(Boolean) as typeof candidates;
  const list = [...extra, ...candidates];

  return (
    <>
      <Hero
        back={{ href: `/ax/published/${issueId}/${articleId}`, label: article.subtitle || article.title || "게재 원고" }}
        title="원문 비교"
        meta={
          <>
            <span>
              {issue.project} {issue.issue_label}
            </span>
            <span>{[article.author_name, article.hall].filter(Boolean).join(" ")}</span>
            <span className="muted">탈고문 {finalText.length.toLocaleString("ko-KR")}자</span>
          </>
        }
      />
      <CompareView
        articleId={articleId}
        finalText={finalText}
        candidates={list}
        chosenIds={chosenIds}
        comments={comments}
        labels={labels}
        userEmail={user.email}
      />
    </>
  );
}

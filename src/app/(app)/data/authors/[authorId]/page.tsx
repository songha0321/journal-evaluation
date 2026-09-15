import { notFound } from "next/navigation";
import { Hero } from "@/components/ui/Hero";
import { AuthorProfileCard } from "@/components/AuthorProfileCard";
import { QnaAnswerCard } from "@/components/QnaAnswerCard";
import { EvaluationPanel } from "@/components/EvaluationPanel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getAuthor,
  getAuthorQna,
  getAuthorEvaluations,
  getAuthorSubmissions,
} from "@/lib/queries/essays";
import { cohortLabel } from "@/lib/format";

import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthorDetailPage({
  params,
}: {
  params: Promise<{ authorId: string }>;
}) {
  // 편집자도 열람 가능. 용역비는 관리자에게만 보인다 (QA R6-02)
  const admin = isAdmin(await getCurrentUser());
  const { authorId } = await params;
  const rawAuthor = await getAuthor(authorId);
  if (!rawAuthor) notFound();
  // 편집자에게는 작성자 행의 용역비도 페이로드에 싣지 않는다 (QA R6-02)
  const author = admin ? rawAuthor : { ...rawAuthor, scholarship_amount: 0 };

  const [qna, allEvaluations, submissions] = await Promise.all([
    getAuthorQna(authorId),
    getAuthorEvaluations(authorId),
    getAuthorSubmissions(authorId),
  ]);
  // 편집자에게는 용역비 금액과 "용역비 등급 …" 요약을 페이로드에서부터 뺀다 (QA R6-02)
  const evaluations = admin
    ? allEvaluations
    : allEvaluations.map((e) => ({
        ...e,
        scholarship_amount: 0,
        evaluation_summary: e.evaluation_summary?.includes("용역비") ? null : e.evaluation_summary,
      }));

  return (
    <>
      <Hero
        back={{ href: "/data/authors", label: "작성자 DB" }}
        title={author.name}
        meta={
          <>
            <span>{cohortLabel(author.cohort)}</span>
            {author.student_type && <span>{author.student_type}</span>}
            {author.final_university && <span>{author.final_university}</span>}
            <span className="muted">수기 {qna.length}문항</span>
          </>
        }
      />
      <div className="page-body">
        <div className="detail-grid">
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>
              질의응답 ({qna.length})
            </div>
            <div className="card">
              {qna.length === 0 ? (
                <span className="faint">질의응답 없음</span>
              ) : (
                qna.map((item) => <QnaAnswerCard key={item.question_id} item={item} />)
              )}
            </div>
          </div>

          <div>
            <div className="section-title" style={{ marginTop: 0 }}>
              프로필
            </div>
            <AuthorProfileCard author={author} />

            {submissions.length > 0 ? (
              <>
                <div className="section-title">제출 파일</div>
                <div className="card">
                  {submissions.map((s) => (
                    <div
                      key={s.id}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0" }}
                    >
                      <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.file_url ? (
                          <a href={s.file_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                            {s.original_file_name ?? "답안지 파일"}
                          </a>
                        ) : (
                          s.original_file_name ?? "파일 없음"
                        )}
                      </span>
                      <StatusBadge value={s.status} kind="submission" />
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className="section-title">평가</div>
            <EvaluationPanel evaluations={evaluations} showFee={admin} />
          </div>
        </div>
      </div>
    </>
  );
}

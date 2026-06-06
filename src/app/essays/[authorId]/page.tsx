import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { AuthorProfileCard } from "@/components/AuthorProfileCard";
import { QnaAnswerCard } from "@/components/QnaAnswerCard";
import { EvaluationPanel } from "@/components/EvaluationPanel";
import { StubButton } from "@/components/StubButton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getAuthor,
  getAuthorQna,
  getAuthorEvaluations,
  getAuthorSubmissions,
} from "@/lib/queries/essays";
import { cohortLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EssayDetailPage({
  params,
}: {
  params: Promise<{ authorId: string }>;
}) {
  const { authorId } = await params;
  const author = await getAuthor(authorId);
  if (!author) notFound();

  const [qna, evaluations, submissions] = await Promise.all([
    getAuthorQna(authorId),
    getAuthorEvaluations(authorId),
    getAuthorSubmissions(authorId),
  ]);

  return (
    <>
      <PageHeader
        title={`${author.name} · ${cohortLabel(author.cohort)}`}
        desc={author.final_university ?? undefined}
        actions={
          <>
            <Link href="/essays" className="btn">
              ← 목록
            </Link>
            <StubButton label="자동 탈고" primary note="원문 보존 자동 탈고는 다음 차수에서 제공됩니다." />
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
            <EvaluationPanel evaluations={evaluations} />
          </div>
        </div>
      </div>
    </>
  );
}

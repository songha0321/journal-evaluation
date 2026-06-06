import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { StubButton } from "@/components/StubButton";
import { StatusBadge } from "@/components/StatusBadge";
import { getArticleByAuthor } from "@/lib/queries/articles";
import { getAuthor } from "@/lib/queries/essays";
import { cohortLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function Pane({ title, value, placeholder }: { title: string; value: string | null; placeholder: string }) {
  return (
    <div className="pane">
      <h3>{title}</h3>
      <textarea readOnly defaultValue={value ?? ""} placeholder={placeholder} />
    </div>
  );
}

export default async function ArticleEditorPage({
  params,
}: {
  params: Promise<{ authorId: string }>;
}) {
  const { authorId } = await params;
  const author = await getAuthor(authorId);
  if (!author) notFound();
  const article = await getArticleByAuthor(authorId);

  return (
    <>
      <PageHeader
        title={`원고 편집 — ${author.name}`}
        desc={`${cohortLabel(author.cohort)} · ${author.final_university ?? ""}`}
        actions={
          <>
            <Link href="/articles" className="btn">
              ← 목록
            </Link>
            <StubButton label="docx export" note="목차별 docx 생성은 다음 차수에서 제공됩니다." />
            <StubButton label="저장" primary note="원고 편집 저장/버전 관리는 다음 차수에서 제공됩니다." />
          </>
        }
      />
      <div className="page-body">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <span className="muted">상태</span>
          <StatusBadge value={article?.article_status ?? "draft"} kind="article" />
          {!article ? <span className="faint">· 원고 미작성 (초안 대기)</span> : null}
        </div>

        <div className="pane-grid">
          <Pane title="원문 / 초안" value={article?.draft_content ?? null} placeholder="원문(수기) 또는 자동 탈고 전 초안" />
          <Pane title="탈고문" value={article?.edited_content ?? null} placeholder="자동 탈고 결과 (REVISE.md 기준)" />
          <Pane title="최종 원고" value={article?.final_content ?? null} placeholder="최종 확정 본문" />
        </div>

        <div className="section-title">항해일지 구성 요소</div>
        <div className="stat-grid">
          <div className="card">
            <div className="label muted" style={{ marginBottom: 6 }}>
              항해일지 comment
            </div>
            <p className="faint" style={{ margin: "0 0 10px" }}>
              {"준비중 — 핵심 내용을 1~2줄로 자동 생성"}
            </p>
            <StubButton label="comment 생성" note="comment 생성은 다음 차수에서 제공됩니다." />
          </div>
          <div className="card">
            <div className="label muted" style={{ marginBottom: 6 }}>
              소제목
            </div>
            <p className="faint" style={{ margin: "0 0 10px" }}>
              {"준비중 — 수기별 소제목 자동 생성"}
            </p>
            <StubButton label="소제목 생성" note="소제목 생성은 다음 차수에서 제공됩니다." />
          </div>
          <div className="card">
            <div className="label muted" style={{ marginBottom: 6 }}>
              중요 문장 밑줄
            </div>
            <p className="faint" style={{ margin: "0 0 10px" }}>
              {"준비중 — 핵심 문장 추천 및 밑줄"}
            </p>
            <StubButton label="밑줄 추천" note="밑줄 추천은 다음 차수에서 제공됩니다." />
          </div>
        </div>
      </div>
    </>
  );
}

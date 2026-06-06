import type { Author } from "@/types/entities";
import { cohortLabel } from "@/lib/format";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v ?? <span className="faint">-</span>}</dd>
    </>
  );
}

export function AuthorProfileCard({ author }: { author: Author }) {
  const subjects = [author.sci1_subject, author.sci2_subject].filter(Boolean).join(" · ");
  return (
    <div className="card">
      <dl className="kv">
        <Row k="이름" v={author.name} />
        <Row k="기수" v={cohortLabel(author.cohort)} />
        <Row k="유형" v={author.student_type} />
        <Row k="관 / 반" v={[author.hall, author.class_name].filter(Boolean).join(" ") || null} />
        <Row k="최종 대학" v={author.final_university} />
        <Row k="탐구" v={subjects || null} />
        <Row k="성별" v={author.sex} />
        <Row k="AI 등급" v={author.ai_evaluation_grade} />
        <Row k="수동 등급" v={author.manual_rating} />
        {author.memo ? <Row k="메모" v={author.memo} /> : null}
      </dl>
    </div>
  );
}

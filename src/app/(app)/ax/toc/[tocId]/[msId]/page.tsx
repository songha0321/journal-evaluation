import { notFound } from "next/navigation";
import { getManuscript, getToc, tocLabel } from "@/lib/ax";
import { parseEdits } from "@/lib/revision";
import { RevisionEditor } from "@/components/ax/RevisionEditor";
import { Hero } from "@/components/ui/Hero";
import { listEditComments } from "@/lib/queries/compare";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManuscriptEditPage({
  params,
}: {
  params: Promise<{ tocId: string; msId: string }>;
}) {
  const { tocId, msId } = await params;
  const [ms, toc] = await Promise.all([getManuscript(msId), getToc(tocId)]);
  if (!ms || !toc) notFound();
  const [comments, user] = await Promise.all([listEditComments(msId), getCurrentUser()]);

  let highlights: string[] = [];
  try {
    highlights = ms.highlights_json ? (JSON.parse(ms.highlights_json) as string[]) : [];
  } catch {
    highlights = [];
  }

  return (
    <>
      <Hero
        back={{ href: `/ax/toc/${tocId}`, label: tocLabel(toc) }}
        title={ms.name}
        meta={
          <>
            {ms.student_type && <span>{ms.student_type}</span>}
            {ms.final_university && <span>{ms.final_university}</span>}
            {ms.question_key && <span className="muted">질문 {ms.question_key}</span>}
          </>
        }
      />
      <RevisionEditor
        id={ms.id}
        tocId={tocId}
        name={ms.name ?? ""}
        university={ms.final_university ?? ""}
        studentType={ms.student_type ?? ""}
        questionText={`${ms.question_key ? `[${ms.question_key}] ` : ""}${ms.question_text ?? ""}`}
        original={ms.answer_text ?? ""}
        subtitle={ms.subtitle ?? ""}
        comment={ms.comment ?? ""}
        editedText={ms.edited_text ?? ""}
        edits={parseEdits(ms.revision_json)}
        highlights={highlights}
        status={ms.status}
        needsReview={ms.needs_review}
        updatedAt={ms.updated_at}
        comments={comments}
        userEmail={user?.email ?? ""}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { getManuscript, getToc, tocLabel } from "@/lib/ax";
import { parseEdits } from "@/lib/revision";
import { RevisionEditor } from "@/components/ax/RevisionEditor";
import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function ManuscriptEditPage({
  params,
}: {
  params: Promise<{ tocId: string; msId: string }>;
}) {
  const { tocId, msId } = await params;
  const [ms, toc] = await Promise.all([getManuscript(msId), getToc(tocId)]);
  if (!ms || !toc) notFound();

  let highlights: string[] = [];
  try {
    highlights = ms.highlights_json ? (JSON.parse(ms.highlights_json) as string[]) : [];
  } catch {
    highlights = [];
  }

  return (
    <>
      <div className="hero">
        <BackLink href={`/ax/toc/${tocId}`} label={tocLabel(toc)} />
        <div className="eyebrow" style={{ marginTop: 10 }}>
          {toc.project} · {toc.issue_label} · {tocLabel(toc)}
        </div>
        <h1>{ms.name}</h1>
      </div>
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
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { getManuscript, assembleOriginal } from "@/lib/ax";
import { Editor } from "@/components/ax/Editor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ms = await getManuscript(id);
  if (!ms) notFound();
  const original = await assembleOriginal(ms.author_id);
  return (
    <Editor
      id={ms.id}
      tocId={ms.toc_id}
      authorId={ms.author_id}
      name={ms.name || ""}
      university={ms.final_university || ""}
      studentType={ms.student_type || ""}
      score={ms.total_score ?? null}
      original={original}
      subtitle={ms.subtitle || ""}
      comment={ms.comment || ""}
      editedText={ms.edited_text || ""}
      highlights={ms.highlights_json ? (JSON.parse(ms.highlights_json) as string[]) : []}
      status={ms.status}
    />
  );
}

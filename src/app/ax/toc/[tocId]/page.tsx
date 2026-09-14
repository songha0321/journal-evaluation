import { notFound } from "next/navigation";
import { getToc, listManuscriptsByToc, tocLabel } from "@/lib/ax";
import { ManuscriptBoard } from "@/components/ax/ManuscriptBoard";
import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function TocManuscriptsPage({ params }: { params: Promise<{ tocId: string }> }) {
  const { tocId } = await params;
  const toc = await getToc(tocId);
  if (!toc) notFound();
  const manuscripts = await listManuscriptsByToc(tocId);

  return (
    <>
      <div className="hero">
        <BackLink href={`/ax/issues/${toc.issue_id}/revise`} label="AI 원고 탈고" />
        <div className="eyebrow" style={{ marginTop: 10 }}>
          {toc.project} · {toc.issue_label}
        </div>
        <h1>{tocLabel(toc)}</h1>
      </div>
      <ManuscriptBoard toc={toc} manuscripts={manuscripts} />
    </>
  );
}

import { notFound } from "next/navigation";
import { getToc, listManuscriptsByToc, tocLabel } from "@/lib/ax";
import { ManuscriptBoard } from "@/components/ax/ManuscriptBoard";
import { Hero } from "@/components/ui/Hero";

export const dynamic = "force-dynamic";

export default async function TocManuscriptsPage({ params }: { params: Promise<{ tocId: string }> }) {
  const { tocId } = await params;
  const toc = await getToc(tocId);
  if (!toc) notFound();
  const manuscripts = await listManuscriptsByToc(tocId);

  return (
    <>
      <Hero
        back={{ href: `/ax/issues/${toc.issue_id}/revise`, label: `${toc.project} ${toc.issue_label}` }}
        title={tocLabel(toc)}
        meta={
          <>
            <span>선별 원고 {manuscripts.length}편</span>
            <span>확정 {manuscripts.filter((m) => m.status === "final").length}편</span>
            <span>선별 개수 {toc.select_count}편</span>
          </>
        }
      />
      <ManuscriptBoard toc={toc} manuscripts={manuscripts} />
    </>
  );
}

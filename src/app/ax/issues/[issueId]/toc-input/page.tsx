import { listTocsByIssue } from "@/lib/ax";
import { TocInputEditor } from "@/components/ax/TocInputEditor";

export const dynamic = "force-dynamic";

export default async function TocInputPage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const tocs = await listTocsByIssue(issueId);
  return <TocInputEditor issueId={issueId} initial={tocs} />;
}

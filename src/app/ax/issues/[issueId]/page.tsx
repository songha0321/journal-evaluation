import { redirect } from "next/navigation";

export default async function IssueIndex({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  redirect(`/ax/issues/${issueId}/toc-input`);
}

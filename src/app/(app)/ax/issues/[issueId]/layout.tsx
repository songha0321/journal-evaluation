import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { getIssue, listTocsByIssue } from "@/lib/ax";
import { issueStages, issueProgress, currentTabSlug } from "@/lib/ax-progress";
import { StageTabs } from "@/components/ax/StageTabs";
import { IssueHero } from "@/components/ax/IssueHero";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const dynamic = "force-dynamic";

export default async function IssueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  const issue = await getIssue(issueId);
  if (!issue) notFound();
  const tocs = await listTocsByIssue(issueId);
  const prog = issueProgress(tocs);
  const stages = issueStages(tocs);
  const currentSlug = currentTabSlug(stages);

  return (
    <>
      <IssueHero issue={issue} back={{ href: "/ax/issues", label: "편집 중 항해일지" }}>
        <>
          <span>대상 기수 {issue.cohort ? `${issue.cohort}기` : "미지정"}</span>
          <span>목차 {tocs.length}개</span>
          <span>확정 수기 {issue.ms_count ?? 0}개</span>
          <span style={{ width: 200 }}>
            <ProgressBar pct={prog.pct} warn={prog.needsReview > 0} />
          </span>
          {prog.needsReview > 0 && (
            <span className="badge amber">
              <Icon as={TriangleAlert} size="sm" />
              검수 필요 {prog.needsReview}
            </span>
          )}
        </>
      </IssueHero>

      <StageTabs stages={stages} issueId={issueId} currentSlug={currentSlug} />
      {children}
    </>
  );
}

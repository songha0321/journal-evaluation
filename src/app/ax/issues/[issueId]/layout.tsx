import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { getIssue, listTocsByIssue } from "@/lib/ax";
import { issueStages, issueProgress } from "@/lib/ax-progress";
import { StageStepper } from "@/components/ax/StageStepper";
import { GnbTabs } from "@/components/ax/GnbTabs";
import { BackLink } from "@/components/ui/BackLink";
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

  return (
    <>
      {/* 히어로 — 프로젝트/호차는 최상단에 */}
      <div className="hero">
        <BackLink href="/ax/issues" label="편집 중 항해일지" />
        <div className="eyebrow" style={{ marginTop: 10 }}>
          {issue.project}
        </div>
        <h1>{issue.issue_label}</h1>
        <div className="hero-meta">
          <span>대상 기수 {issue.cohort ? `${issue.cohort}기` : "미지정"}</span>
          <span>목차 {tocs.length}개</span>
          <span>확정 수기 {issue.ms_count ?? 0}개</span>
          <span style={{ width: 200 }}>
            <ProgressBar pct={prog.pct} warn={prog.needsReview > 0} />
          </span>
          {prog.needsReview > 0 && (
            <span className="badge amber">
              <TriangleAlert size={12} strokeWidth={2} aria-hidden />
              검수 필요 {prog.needsReview}
            </span>
          )}
        </div>
      </div>

      <StageStepper stages={issueStages(tocs)} />
      <GnbTabs issueId={issueId} />
      {children}
    </>
  );
}

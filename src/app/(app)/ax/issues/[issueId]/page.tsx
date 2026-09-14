import { listTocsByIssue } from "@/lib/ax";
import { issueStages, currentTabSlug } from "@/lib/ax-progress";
import TocInputPage from "./toc-input/page";
import AiSelectPage from "./ai-select/page";
import RevisePage from "./revise/page";

export const dynamic = "force-dynamic";

/**
 * 호차 주소로 들어오면 현재 진행 단계의 탭 화면을 바로 그린다.
 * (리다이렉트는 스트리밍 응답에서 브라우저 측 처리라 빈 화면이 먼저 보였다.)
 */
export default async function IssueIndex({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const tocs = await listTocsByIssue(issueId);
  const slug = currentTabSlug(issueStages(tocs));
  if (slug === "ai-select") return <AiSelectPage params={params} />;
  if (slug === "revise") return <RevisePage params={params} />;
  return <TocInputPage params={params} />;
}

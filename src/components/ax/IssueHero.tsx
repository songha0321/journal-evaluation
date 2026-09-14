import { Hero } from "@/components/ui/Hero";
import { coverUrl } from "@/lib/covers";
import type { Issue } from "@/lib/ax";

/** 호차 히어로 = 공통 Hero + 표지(없으면 항해일지 배경). 제목은 "2027 항해일지 1호차" 한 줄. */
export function IssueHero({
  issue,
  back,
  children,
}: {
  issue: Issue;
  back: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return <Hero back={back} title={`${issue.project} ${issue.issue_label}`} meta={children} cover={coverUrl(issue) ?? "/hero-bg.jpg"} />;
}

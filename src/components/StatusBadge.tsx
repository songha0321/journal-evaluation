import {
  SUBMISSION_STATUS_LABEL,
  ARTICLE_STATUS_LABEL,
  AI_SUSPICION_LABEL,
} from "@/lib/format";

const TONE: Record<string, string> = {
  // submission
  received: "gray",
  reviewing: "amber",
  selected: "green",
  rejected: "red",
  archived: "gray",
  // article
  draft: "gray",
  editing: "amber",
  review: "amber",
  final: "green",
  published: "accent",
  // ai suspicion
  low: "green",
  medium: "amber",
  high: "red",
};

export function StatusBadge({
  value,
  kind,
}: {
  value: string | null | undefined;
  kind: "submission" | "article" | "suspicion";
}) {
  if (!value) return <span className="faint">-</span>;
  const labelMap =
    kind === "submission"
      ? SUBMISSION_STATUS_LABEL
      : kind === "article"
        ? ARTICLE_STATUS_LABEL
        : AI_SUSPICION_LABEL;
  const tone = TONE[value] ?? "gray";
  return <span className={`badge ${tone}`}>{labelMap[value] ?? value}</span>;
}

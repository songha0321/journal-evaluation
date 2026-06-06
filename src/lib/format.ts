// Display helpers. User-facing strings are Korean per CLAUDE.md.

/** 150000 -> "150,000원" ; null/0 handled. */
export function formatWon(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** Compact 만원 label for dense tables: 150000 -> "15만". */
export function formatManWon(amount: number | null | undefined): string {
  if (amount == null) return "-";
  if (amount % 10000 === 0) return `${(amount / 10000).toLocaleString("ko-KR")}만`;
  return formatWon(amount);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  // D1 stores ISO-ish TEXT; show date portion.
  return iso.slice(0, 10);
}

export function cohortLabel(cohort: number | null | undefined): string {
  return cohort == null ? "-" : `${cohort}기`;
}

/** PRD 선별 rule: 수기평 0~5의 4점 이상 → 선별. total_score is on a 0~100 scale (×20). */
export const SELECT_THRESHOLD = 80;

export function isSelected(totalScore: number | null | undefined): boolean {
  return totalScore != null && totalScore >= SELECT_THRESHOLD;
}

/** 0~100 total_score back to the 0~5 수기평 scale for display. */
export function toFiveScale(totalScore: number | null | undefined): string {
  if (totalScore == null) return "-";
  return String(Math.round(totalScore / 20));
}

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  received: "접수",
  reviewing: "검토중",
  selected: "선별됨",
  rejected: "제외",
  archived: "보관",
};

export const ARTICLE_STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  editing: "편집중",
  review: "검토",
  final: "최종",
  published: "발행",
  archived: "보관",
};

export const AI_SUSPICION_LABEL: Record<string, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

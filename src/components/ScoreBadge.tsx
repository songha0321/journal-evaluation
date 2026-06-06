import { isSelected, toFiveScale } from "@/lib/format";

/** 총점(0~100)을 0~5 표기 배지로. 4점(=80)↑이면 선별색. */
export function ScoreBadge({ totalScore }: { totalScore: number | null | undefined }) {
  if (totalScore == null) return <span className="faint">-</span>;
  const tone = isSelected(totalScore) ? "green" : totalScore >= 60 ? "amber" : "gray";
  return (
    <span className={`badge ${tone}`}>
      {toFiveScale(totalScore)}점
    </span>
  );
}

export function SelectBadge({ totalScore }: { totalScore: number | null | undefined }) {
  return isSelected(totalScore) ? (
    <span className="badge green">선별</span>
  ) : (
    <span className="badge gray">제외</span>
  );
}

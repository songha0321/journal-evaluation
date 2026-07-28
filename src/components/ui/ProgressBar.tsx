/** 진행률 바. 0% 회색 / 1–99% coral / 100% green. needs_review가 있으면 100%여도 green으로 칠하지 않는다. */
export function ProgressBar({
  pct,
  warn = false,
  showPct = true,
}: {
  pct: number;
  warn?: boolean;
  showPct?: boolean;
}) {
  const tone = warn ? "warn" : pct <= 0 ? "zero" : pct >= 100 ? "full" : "";
  return (
    <div className="progress-row">
      <div className={`progress ${tone}`.trim()}>
        <i style={{ width: `${Math.max(pct, 0)}%` }} />
      </div>
      {showPct && <span className="pct">{pct}%</span>}
    </div>
  );
}

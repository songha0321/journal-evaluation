import type { Evaluation } from "@/types/entities";
import { formatWon, formatDate, toFiveScale } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { SelectBadge } from "./ScoreBadge";

function Chip({ label, v }: { label: string; v: number | null }) {
  if (v == null) return null;
  return (
    <span className="score-chip">
      {label} {v}
    </span>
  );
}

export function EvaluationPanel({ evaluations }: { evaluations: Evaluation[] }) {
  if (evaluations.length === 0) {
    return (
      <div className="card">
        <div className="section-title" style={{ margin: 0 }}>
          평가
        </div>
        <p className="faint" style={{ margin: "8px 0 0" }}>
          평가 내역 없음
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="section-title" style={{ margin: "0 0 10px" }}>
        평가 · 용역비
      </div>
      {evaluations.map((e) => (
        <div key={e.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span className="badge accent">
              {e.evaluator_type === "ai" ? "AI" : "수기"} {toFiveScale(e.total_score)}점
            </span>
            <SelectBadge totalScore={e.total_score} />
            {e.ai_suspicion_level ? (
              <StatusBadge value={e.ai_suspicion_level} kind="suspicion" />
            ) : null}
            <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>
              {formatDate(e.created_at)}
            </span>
          </div>
          <div className="score-chips" style={{ marginBottom: 8 }}>
            <Chip label="구체성" v={e.specificity_score} />
            <Chip label="진정성" v={e.authenticity_score} />
            <Chip label="서술" v={e.narrative_score} />
            <Chip label="유용성" v={e.usefulness_score} />
          </div>
          {e.evaluation_summary ? (
            <p className="muted" style={{ margin: "0 0 6px" }}>
              {e.evaluation_summary}
            </p>
          ) : null}
          <div className="kv" style={{ gridTemplateColumns: "72px 1fr" }}>
            <dt>용역비</dt>
            <dd>
              <strong>{formatWon(e.scholarship_amount)}</strong>
            </dd>
            {e.evidence ? (
              <>
                <dt>평가자</dt>
                <dd>{e.evidence}</dd>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

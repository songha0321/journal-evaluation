import { Check } from "lucide-react";
import type { StageState } from "@/lib/ax-progress";

/**
 * 원고 제작 6단계 스테퍼 (PROCESS.md §4.1).
 * 완료 단계는 채우고, 현재 단계는 강조 + 분수 표시, 이후 단계는 흐리게.
 */
export function StageStepper({ stages }: { stages: StageState[] }) {
  const currentIdx = stages.findIndex((s) => !s.done);

  return (
    <div className="stepper" role="list" aria-label="원고 제작 진행 단계">
      {stages.map((s, i) => {
        const state = s.done ? "done" : i === currentIdx ? "current" : "";
        return (
          <div key={s.key} className={`step ${state}`.trim()} role="listitem">
            <span className="dot">
              {s.done ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
              )}
            </span>
            <span className="step-label">{s.label}</span>
            {i === currentIdx && s.fraction && s.fraction.d > 0 && (
              <span className="step-sub">
                {s.fraction.n}/{s.fraction.d}
              </span>
            )}
            {s.done && <span className="step-sub">완료</span>}
          </div>
        );
      })}
    </div>
  );
}

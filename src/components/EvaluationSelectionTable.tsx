"use client";

import { useState } from "react";
import Link from "next/link";
import type { EvaluationRow } from "@/lib/queries/evaluations";
import { isSelected, toFiveScale, formatWon, cohortLabel } from "@/lib/format";
import { SelectBadge } from "./ScoreBadge";
import { StubButton } from "./StubButton";

/**
 * 평가/선별 비교표. 최종선택은 1차에서 in-memory (selections 테이블 영속화는 다음 차수).
 */
export function EvaluationSelectionTable({ rows }: { rows: EvaluationRow[] }) {
  // 기본 선택 = AI 선별 기준(4점↑) 충족 행.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter((r) => isSelected(r.total_score)).map((r) => r.evaluation_id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div className="muted">
          최종 선택 <strong>{selected.size}</strong> / {rows.length}건
        </div>
        <StubButton
          label="최종 선별 확정"
          primary
          note="선택 결과를 selections에 저장하고 탈고로 넘기는 기능은 다음 차수에서 제공됩니다."
        />
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>이름</th>
              <th>기수</th>
              <th>유형</th>
              <th>최종대학</th>
              <th className="num">점수</th>
              <th>선별</th>
              <th>평가 사유</th>
              <th className="num">용역비</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.evaluation_id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.evaluation_id)}
                    onChange={() => toggle(r.evaluation_id)}
                    aria-label={`${r.name} 선택`}
                  />
                </td>
                <td>
                  <Link href={`/essays/${r.author_id}`} className="row-link">
                    {r.name}
                  </Link>
                </td>
                <td>{cohortLabel(r.cohort)}</td>
                <td>{r.student_type ?? "-"}</td>
                <td>{r.final_university ?? "-"}</td>
                <td className="num">{toFiveScale(r.total_score)}점</td>
                <td>
                  <SelectBadge totalScore={r.total_score} />
                </td>
                <td style={{ whiteSpace: "normal", maxWidth: 360 }} className="muted">
                  {r.evaluation_summary ?? "-"}
                </td>
                <td className="num">{formatWon(r.scholarship_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

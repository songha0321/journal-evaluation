/**
 * 탈고 교정 항목 — REVISE.md 우선순위(P0~P5)를 UI에서 구분 가능한 5종으로 묶는다.
 * 편집자는 항목마다 '반영하기' / '되돌리기'로 개별 승인한다(FR-013).
 */

export type RevisionKind = "typo" | "sensitive" | "structure" | "term" | "flow";

export interface RevisionEdit {
  id: string;
  kind: RevisionKind;
  /** 원문에서 바뀌는 구간. 빈 문자열이면 순수 추가 */
  before: string;
  /** 바뀐 결과. 빈 문자열이면 삭제 */
  after: string;
  /** 교정 사유 한 줄 */
  note: string;
  /** 편집자 승인 여부. 저장 시 이 값만 본문에 반영된다 */
  applied: boolean;
}

/** REVISE.md 대응 + 화면 색상. 색은 globals.css의 .rk-* 와 짝을 이룬다. */
export const KIND_META: Record<RevisionKind, { label: string; cls: string; desc: string }> = {
  typo: { label: "오탈자·맞춤법", cls: "rk-typo", desc: "REVISE.md P2 — 국립국어원 기준" },
  sensitive: { label: "민감 표현", cls: "rk-sensitive", desc: "REVISE.md P1 — 삭제 또는 완화" },
  structure: { label: "문장 추가·삭제", cls: "rk-structure", desc: "REVISE.md P4 — 흐름·유기성" },
  term: { label: "용어 통일", cls: "rk-term", desc: "REVISE.md P3 — 편집국 용어 기준" },
  flow: { label: "문장 다듬기", cls: "rk-flow", desc: "REVISE.md P5 — 군더더기 정리" },
};

export function parseEdits(json: string | null | undefined): RevisionEdit[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as RevisionEdit[]) : [];
  } catch {
    return [];
  }
}

/**
 * 승인된 교정만 원문에 순서대로 반영한다.
 * 위치 인덱스가 아니라 `before` 문자열 탐색으로 적용한다 — 앞선 교정이 길이를 바꿔도
 * 뒤 교정이 어긋나지 않는다. 원문에서 사라진 구간은 조용히 건너뛴다(stale edit).
 */
export function applyEdits(original: string, edits: RevisionEdit[]): string {
  let out = original;
  for (const e of edits) {
    if (!e.applied) continue;
    if (!e.before) continue; // 순수 추가는 위치를 특정할 수 없어 본문 반영에서 제외
    const i = out.indexOf(e.before);
    if (i < 0) continue;
    out = out.slice(0, i) + e.after + out.slice(i + e.before.length);
  }
  return out;
}

/** 원문에서 더 이상 찾을 수 없는(이미 손으로 고쳐진) 교정 항목 */
export function isStale(original: string, e: RevisionEdit): boolean {
  return Boolean(e.before) && !original.includes(e.before);
}

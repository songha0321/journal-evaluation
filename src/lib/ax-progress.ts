import type { Toc, Issue } from "@/lib/ax";

/**
 * 원고 제작 6단계 — PROCESS.md §3의 단일 구현체.
 * UI·API가 각자 진행률을 계산하지 않고 반드시 이 파일을 통한다.
 */

export type StageKey = "toc_input" | "ai_shortlist" | "editor_pick" | "ai_revise" | "editor_final" | "export";

export interface StageDef {
  key: StageKey;
  label: string;
  /** 실행 주체 — AI ↔ 편집자가 번갈아 진행한다 */
  actor: "편집자" | "AI" | "산출";
  weight: number;
  /** 목차 단위(0/1 판정) vs 원고 단위(비율 판정) */
  unit: "toc" | "manuscript";
}

export const STAGES: StageDef[] = [
  { key: "toc_input", label: "목차 입력", actor: "편집자", weight: 10, unit: "toc" },
  { key: "ai_shortlist", label: "AI 수기 선별", actor: "AI", weight: 10, unit: "toc" },
  { key: "editor_pick", label: "편집자 수기 확정", actor: "편집자", weight: 15, unit: "manuscript" },
  { key: "ai_revise", label: "AI 원고 탈고", actor: "AI", weight: 25, unit: "manuscript" },
  { key: "editor_final", label: "편집자 원고 확정", actor: "편집자", weight: 35, unit: "manuscript" },
  { key: "export", label: "EXPORT", actor: "산출", weight: 5, unit: "toc" },
];

/** GNB 탭은 3개 화면으로 묶인다 (목차 입력 / AI 수기 선별+편집자 확정 / AI 탈고+편집자 확정+EXPORT) */
export const GNB_TABS = [
  { slug: "toc-input", label: "목차 입력", stages: ["toc_input"] as StageKey[] },
  { slug: "ai-select", label: "AI 수기 선별", stages: ["ai_shortlist", "editor_pick"] as StageKey[] },
  { slug: "revise", label: "AI 원고 탈고", stages: ["ai_revise", "editor_final", "export"] as StageKey[] },
];

export interface StageState {
  key: StageKey;
  label: string;
  actor: StageDef["actor"];
  /** 0 ~ 1 */
  ratio: number;
  done: boolean;
  /** 원고 단위 단계에서 표시할 분수 (예: 8/10). 목차 단위면 null */
  fraction: { n: number; d: number } | null;
}

export interface TocProgress {
  pct: number;
  stages: StageState[];
  /** 완료율이 1 미만인 가장 낮은 단계. 전부 완료면 null */
  current: StageState | null;
  needsReview: number;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * 목차 진행률.
 * 원고 단위 단계(ai_revise·editor_final)의 분모는 select_count가 아니라 **실제 확정 원고 수**다.
 * 편집자가 목표보다 적게 확정하고 마감하는 경우가 있어, 목표치로 나누면 100%에 도달하지 못한다.
 */
export function tocProgress(t: Toc): TocProgress {
  const ms = t.ms_count ?? 0;
  const denom = Math.max(1, ms);
  const hasInput = Boolean(t.toc_content?.trim() && t.hanmadi?.trim());

  const ratios: Record<StageKey, number> = {
    toc_input: hasInput ? 1 : 0,
    ai_shortlist: t.shortlisted_at ? 1 : 0,
    editor_pick: clamp01(ms / Math.max(1, t.select_count)),
    // 확정 원고가 없으면 원고 단위 단계는 '진행 중'이 아니라 미시작이다.
    ai_revise: ms === 0 ? 0 : clamp01((t.composed_count ?? 0) / denom),
    editor_final: ms === 0 ? 0 : clamp01((t.final_count ?? 0) / denom),
    export: t.exported_at ? 1 : 0,
  };

  const stages: StageState[] = STAGES.map((s) => {
    const ratio = ratios[s.key];
    let fraction: StageState["fraction"] = null;
    if (s.key === "editor_pick") fraction = { n: ms, d: t.select_count };
    if (s.key === "ai_revise") fraction = { n: t.composed_count ?? 0, d: ms };
    if (s.key === "editor_final") fraction = { n: t.final_count ?? 0, d: ms };
    return { key: s.key, label: s.label, actor: s.actor, ratio, done: ratio >= 1, fraction };
  });

  const pct = Math.round(STAGES.reduce((sum, s) => sum + s.weight * ratios[s.key], 0));
  return {
    pct,
    stages,
    current: stages.find((s) => !s.done) ?? null,
    needsReview: t.needs_review_count ?? 0,
  };
}

/** 호차 진행률 = 목차별 진행률의 select_count 가중 평균 (PROCESS.md §3.3) */
export function issueProgress(tocs: Toc[]): { pct: number; tocCount: number; needsReview: number } {
  const needsReview = tocs.reduce((s, t) => s + (t.needs_review_count ?? 0), 0);
  if (tocs.length === 0) return { pct: 0, tocCount: 0, needsReview: 0 };
  let num = 0;
  let den = 0;
  for (const t of tocs) {
    const w = Math.max(1, t.select_count);
    num += tocProgress(t).pct * w;
    den += w;
  }
  return { pct: Math.round(num / den), tocCount: tocs.length, needsReview };
}

/**
 * 호차 단위 6단계 상태 — 호차 상세페이지 스테퍼용.
 * 단계 완료율은 목차별 완료율의 select_count 가중 평균이고,
 * `done`은 **모든 목차가 그 단계를 끝냈을 때만** true다(하나라도 남으면 진행 중).
 */
/** 단계 키 → 그 단계를 다루는 GNB 탭 slug */
export function tabSlugForStage(key: StageKey): string {
  return GNB_TABS.find((t) => t.stages.includes(key))?.slug ?? GNB_TABS[0].slug;
}

/** 호차의 현재 탭 = 아직 끝나지 않은 첫 단계가 속한 탭. 전부 끝났으면 마지막 탭 */
export function currentTabSlug(stages: StageState[]): string {
  const open = stages.find((s) => !s.done);
  return open ? tabSlugForStage(open.key) : GNB_TABS[GNB_TABS.length - 1].slug;
}

export function issueStages(tocs: Toc[]): StageState[] {
  const per = tocs.map((t) => ({ p: tocProgress(t), w: Math.max(1, t.select_count) }));
  const totalW = per.reduce((s, x) => s + x.w, 0) || 1;

  return STAGES.map((s, i) => {
    if (tocs.length === 0) {
      return { key: s.key, label: s.label, actor: s.actor, ratio: 0, done: false, fraction: null };
    }
    const ratio = per.reduce((sum, x) => sum + x.p.stages[i].ratio * x.w, 0) / totalW;
    const doneCount = per.filter((x) => x.p.stages[i].done).length;
    const fraction =
      s.unit === "manuscript" || s.unit === "toc" ? { n: doneCount, d: tocs.length } : null;
    return {
      key: s.key,
      label: s.label,
      actor: s.actor,
      ratio,
      done: doneCount === tocs.length,
      fraction,
    };
  });
}

/** 호차 전체의 수기 개수 퍼널 — 대시보드 카드 */
export function issueFunnel(tocs: Toc[]) {
  const sum = (f: (t: Toc) => number) => tocs.reduce((s, t) => s + f(t), 0);
  return {
    candidates: sum((t) => t.cand_count ?? 0),
    confirmed: sum((t) => t.ms_count ?? 0),
    revised: sum((t) => t.composed_count ?? 0),
    finalized: sum((t) => t.final_count ?? 0),
    exported: tocs.filter((t) => t.exported_at).length,
  };
}

export function issueLabelFull(i: Issue): string {
  return `${i.project} · ${i.issue_label}`;
}

/** 최종 편집 일시 표기 — 목록 칼럼용 */
export function formatEditedAt(v: string | null | undefined): string {
  if (!v) return "-";
  return v.slice(0, 16).replace("T", " ");
}

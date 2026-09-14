"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { GNB_TABS, type StageState } from "@/lib/ax-progress";

/**
 * 호차 제작 단계 줄. PROCESS.md의 6단계를 **같은 화면을 쓰는 단계끼리 묶어 3단계**로 보여준다.
 *   1 목차 입력 / 2 수기 선별과 확정 (AI 선별 → 편집자 확정) / 3 원고 탈고와 확정 (AI 탈고 → 편집자 확정 → EXPORT)
 * 세로 구분선·박스 없이, 열린 화면 하나 아래에만 2px 포인트 밑줄. 부제에 묶인 세부 단계 중 현재 단계와 진행 분수를 적는다.
 */
const GROUP_LABEL: Record<string, string> = {
  "toc-input": "목차 입력",
  "ai-select": "수기 선별과 확정",
  revise: "원고 탈고와 확정",
};

export function StageTabs({ stages, issueId, currentSlug }: { stages: StageState[]; issueId: string; currentSlug: string }) {
  const pathname = usePathname();
  const base = `/ax/issues/${issueId}`;
  const atIndex = pathname === base || pathname === `${base}/`;
  const openSlug = atIndex ? currentSlug : (GNB_TABS.find((t) => pathname.startsWith(`${base}/${t.slug}`))?.slug ?? currentSlug);
  const currentIdx = stages.findIndex((s) => !s.done);

  return (
    <nav className="steps" aria-label="원고 제작 단계">
      {GNB_TABS.map((t, gi) => {
        const members = t.stages.map((k) => stages.find((s) => s.key === k)!).filter(Boolean);
        const done = members.length > 0 && members.every((m) => m.done);
        const cur = members.find((m) => stages.indexOf(m) === currentIdx);
        const state = done ? "done" : cur ? "current" : "upcoming";
        const open = t.slug === openSlug;
        const sub = done
          ? "완료"
          : cur
            ? `${cur.label}${cur.fraction && cur.fraction.d > 0 ? ` ${cur.fraction.n}/${cur.fraction.d}` : ""}`
            : members.map((m) => m.label).join(", ");
        return (
          <Link
            key={t.slug}
            href={`${base}/${t.slug}`}
            className={`step ${state} ${open ? "open" : ""}`.trim()}
            aria-current={open ? "step" : undefined}
            title={members.map((m, i) => `${i + 1}. ${m.label}`).join(" → ")}
          >
            <span className="step-no">{done ? <Icon as={Check} size="sm" /> : gi + 1}</span>
            <span className="step-text">
              <span className="step-label">{GROUP_LABEL[t.slug] ?? t.label}</span>
              <span className="step-sub">{sub}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

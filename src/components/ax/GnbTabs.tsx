"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GNB_TABS } from "@/lib/ax-progress";

/** 호차 상세 GNB. 6단계를 3개 화면으로 묶는다(PROCESS.md §4.1). */
export function GnbTabs({ issueId }: { issueId: string }) {
  const pathname = usePathname();
  const base = `/ax/issues/${issueId}`;
  return (
    <nav className="gnb" aria-label="원고 제작 단계">
      {GNB_TABS.map((t, i) => {
        const href = `${base}/${t.slug}`;
        return (
          <Link key={t.slug} href={href} className={pathname === href ? "active" : ""}>
            <span className="faint" style={{ fontVariantNumeric: "tabular-nums" }}>
              {i + 1}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

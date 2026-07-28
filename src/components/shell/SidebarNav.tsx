"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePen,
  BookCheck,
  Gauge,
  MessagesSquare,
  CircleHelp,
  Users,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

/** 사이드바 IA. 아이콘은 lucide-react 단일 패키지만 사용한다(DESIGN.md 4.7: 선형·currentColor). */
type NavEntry = { section: string } | { href: string; label: string; Icon: LucideIcon; exact?: boolean };

const NAV: NavEntry[] = [
  { section: "원고 관리" },
  { href: "/ax", label: "원고 대시보드", Icon: LayoutDashboard, exact: true },
  { href: "/ax/issues", label: "편집 중 항해일지", Icon: FilePen },
  { href: "/ax/published", label: "편집 완료 항해일지", Icon: BookCheck },
  { section: "데이터 관리" },
  { href: "/data", label: "데이터 대시보드", Icon: Gauge, exact: true },
  { href: "/data/qna", label: "수기 DB", Icon: MessagesSquare },
  { href: "/data/questions", label: "수기 질문지 DB", Icon: CircleHelp },
  { href: "/data/authors", label: "작성자 DB", Icon: Users },
  { href: "/data/evaluations", label: "작성자 평가 DB", Icon: ClipboardCheck },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sidebar-brand">
        시대인재 AUTO
        <small>항해일지 AX 시스템</small>
      </div>
      <nav>
        {NAV.map((item, i) =>
          "section" in item ? (
            <div key={`s-${i}`} className="nav-section">
              {item.section}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive(pathname, item.href, item.exact) ? "active" : ""}`}
            >
              <item.Icon className="ico" size={16} strokeWidth={1.75} aria-hidden />
              {item.label}
            </Link>
          ),
        )}
      </nav>
      <div className="sidebar-user">{userLabel}</div>
    </aside>
  );
}

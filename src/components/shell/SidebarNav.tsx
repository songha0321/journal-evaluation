"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { section: "제작" },
  { href: "/dashboard", label: "대시보드", ico: "▦" },
  { href: "/essays", label: "수기 DB", ico: "✎" },
  { href: "/evaluations", label: "평가 · 선별", ico: "★" },
  { href: "/articles", label: "원고", ico: "▤" },
] as const;

export function SidebarNav({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sidebar-brand">
        시대인재J
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
              className={`nav-item ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "active"
                  : ""
              }`}
            >
              <span className="ico">{item.ico}</span>
              {item.label}
            </Link>
          ),
        )}
      </nav>
      <div className="sidebar-user">{userLabel}</div>
    </aside>
  );
}

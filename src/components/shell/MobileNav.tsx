"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, FilePen, BookCheck, MessagesSquare, Menu, X, Lock, LogOut, UserRound, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { isAdmin, type CurrentUser } from "@/lib/roles";
import { NAV, isActive } from "./SidebarNav";

/**
 * 모바일(≤767px) 내비게이션 — 상단바(로고, 마이페이지) + 하단 탭 4개 + 더보기 시트.
 * 더보기 시트는 사이드바와 같은 NAV 전체를 섹션째 보여준다. 데스크톱에서는 CSS로 숨긴다 (QA R6-12).
 */
const TABS: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
  { href: "/ax", label: "대시보드", Icon: LayoutDashboard, exact: true },
  { href: "/ax/issues", label: "편집 중", Icon: FilePen },
  { href: "/ax/published", label: "편집 완료", Icon: BookCheck },
  { href: "/data/qna", label: "수기 DB", Icon: MessagesSquare },
];

export function MobileNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const admin = isAdmin(user);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const tabActive = TABS.some((t) => isActive(pathname, t.href, t.exact));
  return (
    <>
      <header className="mobile-bar">
        <Link href="/ax" className="mb-brand" title="항해일지 AUTO">
          <img src="/logo-mark.png" alt="" width={24} height={24} />
          <span>항해일지 AUTO</span>
        </Link>
        <Link href="/my" className="mb-user" title="마이페이지" aria-label={`${user.name} 마이페이지`}>
          <Avatar name={user.name} picture={user.picture} />
        </Link>
      </header>

      <div className={`bnb-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className={`bnb-sheet ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="전체 메뉴" aria-hidden={!open}>
        <div className="bnb-sheet-head">
          <b>전체 메뉴</b>
          <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="닫기">
            <Icon as={X} />
          </button>
        </div>
        <nav className="bnb-sheet-nav">
          {NAV.map((item, i) =>
            "section" in item ? (
              <div key={`s-${i}`} className="bnb-sheet-section">
                {item.section}
              </div>
            ) : item.adminOnly && !admin ? (
              item.href === "/admin/users" ? null : (
                <span key={item.href} className="bnb-sheet-item locked" aria-disabled="true">
                  <Icon as={item.Icon} />
                  <span>{item.label}</span>
                  <Icon as={Lock} size="sm" className="nav-lock" />
                </span>
              )
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`bnb-sheet-item ${isActive(pathname, item.href, item.exact) ? "active" : ""}`}
              >
                <Icon as={item.Icon} />
                <span>{item.label}</span>
              </Link>
            ),
          )}
          <div className="bnb-sheet-section">계정</div>
          <Link href="/my" className={`bnb-sheet-item ${pathname === "/my" ? "active" : ""}`}>
            <Icon as={UserRound} />
            <span>
              마이페이지 <span className="faint">{user.name}, {user.role}</span>
            </span>
          </Link>
          <a href="/api/auth/logout" className="bnb-sheet-item">
            <Icon as={LogOut} />
            <span>로그아웃</span>
          </a>
        </nav>
      </div>

      <nav className="bnb" aria-label="모바일 메뉴">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`bnb-item ${isActive(pathname, t.href, t.exact) ? "active" : ""}`}>
            <Icon as={t.Icon} />
            <span>{t.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`bnb-item ${open || !tabActive ? "active" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="전체 메뉴"
        >
          <Icon as={open ? X : Menu} />
          <span>더보기</span>
        </button>
      </nav>
    </>
  );
}

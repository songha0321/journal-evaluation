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
  LogOut,
  Settings,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { isAdmin, type CurrentUser } from "@/lib/roles";

/** 사이드바 IA. 아이콘은 Icon 래퍼(DESIGN.md §6.2.3). */
export type NavEntry = { section: string } | { href: string; label: string; Icon: LucideIcon; exact?: boolean; adminOnly?: boolean };

/** 사이드바와 모바일 더보기 시트가 같은 목록을 쓴다 */
export const NAV: NavEntry[] = [
  { section: "원고 관리" },
  { href: "/ax", label: "원고 대시보드", Icon: LayoutDashboard, exact: true },
  { href: "/ax/issues", label: "편집 중 항해일지", Icon: FilePen },
  { href: "/ax/published", label: "편집 완료 항해일지", Icon: BookCheck },
  { section: "데이터 관리" },
  { href: "/data", label: "데이터 대시보드", Icon: Gauge, exact: true, adminOnly: true },
  { href: "/data/qna", label: "수기 DB", Icon: MessagesSquare },
  { href: "/data/questions", label: "수기 질문지 DB", Icon: CircleHelp, adminOnly: true },
  { href: "/data/authors", label: "작성자 DB", Icon: Users },
  { href: "/data/evaluations", label: "작성자 평가 DB", Icon: ClipboardCheck, adminOnly: true },
  { section: "설정" },
  { href: "/settings", label: "환경설정", Icon: Settings },
  { href: "/admin/users", label: "사용자 권한", Icon: ShieldCheck, adminOnly: true },
];

export function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({
  user,
  collapsed,
  onToggle,
}: {
  user: CurrentUser;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const admin = isAdmin(user);
  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sidebar-top">
        <Link href="/ax" className="sidebar-brand" title="항해일지 AUTO">
          <img src="/logo-mark.png" alt="" width={24} height={24} />
          <span className="word">항해일지 AUTO</span>
        </Link>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          title={collapsed ? "펼치기" : "접기"}
        >
          <Icon as={collapsed ? ChevronRight : ChevronLeft} />
        </button>
      </div>
      <nav>
        {NAV.map((item, i) =>
          "section" in item ? (
            <div key={`s-${i}`} className="nav-section">
              <span className="word">{item.section}</span>
            </div>
          ) : item.adminOnly && !admin ? (
            item.href === "/admin/users" ? null : (
              <span key={item.href} className="nav-item locked" title="관리자만 볼 수 있습니다" aria-disabled="true">
                <Icon as={item.Icon} className="ico" />
                <span className="word">{item.label}</span>
                <Icon as={Lock} size="sm" className="nav-lock" />
              </span>
            )
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive(pathname, item.href, item.exact) ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon as={item.Icon} className="ico" />
              <span className="word">{item.label}</span>
            </Link>
          ),
        )}
      </nav>
      <div className="sidebar-user">
        <Link
          href="/my"
          className={`su-row ${pathname === "/my" ? "active" : ""}`}
          title={collapsed ? `${user.name} 마이페이지` : "마이페이지"}
        >
          <Avatar name={user.name} picture={user.picture} />
          <div className="word su-text">
            <div className="su-name">{user.name}</div>
            <div className="su-role">{user.role}</div>
          </div>
        </Link>
        <a className="su-logout" href="/api/auth/logout" title="로그아웃">
          <Icon as={LogOut} />
          <span className="word">로그아웃</span>
        </a>
      </div>
    </aside>
  );
}

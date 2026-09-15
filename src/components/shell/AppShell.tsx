"use client";

import { useEffect, useState } from "react";
import { SidebarNav } from "./SidebarNav";
import { MobileNav } from "./MobileNav";
import { ScrollTop } from "@/components/ui/ScrollTop";
import { ThemeInit } from "./ThemeInit";
import { loadSettings } from "@/lib/settings";
import type { CurrentUser } from "@/lib/roles";

const KEY = "hj.sidebar.collapsed";

/**
 * 앱 셸. 데스크톱은 고정 사이드바 + 본문.
 * 모바일(≤767px, globals.css)은 사이드바를 숨기고 상단바 + 하단 탭(MobileNav)으로 바뀐다 (QA R6-12).
 */
export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved != null) setCollapsed(saved === "1");
      else setCollapsed(loadSettings().sidebar === "collapsed");
    } catch {
      /* 저장소 불가 환경 */
    }
  }, []);
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <SidebarNav user={user} collapsed={collapsed} onToggle={toggle} />
      <MobileNav user={user} />
      <main className="main">{children}</main>
      <ScrollTop />
      <ThemeInit />
    </div>
  );
}

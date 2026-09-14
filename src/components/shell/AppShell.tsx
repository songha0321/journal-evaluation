"use client";

import { useEffect, useState } from "react";
import { SidebarNav } from "./SidebarNav";
import { ScrollTop } from "@/components/ui/ScrollTop";
import { ThemeInit } from "./ThemeInit";
import { loadSettings } from "@/lib/settings";
import type { CurrentUser } from "@/lib/auth";

const KEY = "hj.sidebar.collapsed";

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
      <main className="main">{children}</main>
      <ScrollTop />
      <ThemeInit />
    </div>
  );
}

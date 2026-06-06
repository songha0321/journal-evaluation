import { SidebarNav } from "./SidebarNav";
import { getCurrentUser } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  return (
    <div className="app-shell">
      <SidebarNav userLabel={`${user.name} · ${user.role}`} />
      <main className="main">{children}</main>
    </div>
  );
}

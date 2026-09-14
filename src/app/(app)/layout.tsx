import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getCurrentUser } from "@/lib/auth";

/**
 * 인증 게이트. 세션 쿠키가 유효한 사용자만 셸 안으로 들인다.
 * middleware.ts는 쿠키 유무만 보고 빠르게 돌려보내고, 서명 검증은 여기서 한다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}

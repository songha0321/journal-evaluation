import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Locked } from "@/components/ui/Locked";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface AppUserRow {
  id: string;
  email: string;
  name: string | null;
  role: "관리자" | "편집자";
  is_active: number;
  last_login_at: string | null;
  created_at: string | null;
}

export default async function UsersAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) return <Locked title="사용자 권한" />;
  const users = await query<AppUserRow>("SELECT id, email, name, role, is_active, last_login_at, created_at FROM app_users ORDER BY created_at");
  return (
    <>
      <PageHeader
        title="사용자 권한"
        desc="로그인할 수 있는 계정과 역할. 관리자는 모든 화면, 편집자는 원고 관리와 수기 DB만 씁니다. 새 계정은 기본 편집자입니다"
      />
      <div className="page-body">
        <UsersAdmin users={users} meId={user.id} />
      </div>
    </>
  );
}

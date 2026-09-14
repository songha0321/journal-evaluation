import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AppUserRow {
  email: string;
  role: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string | null;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const row =
    user.id === "dev-bypass"
      ? null
      : await queryOne<AppUserRow>(
          "SELECT email, role, is_active, last_login_at, created_at FROM app_users WHERE id = ?",
          [user.id],
        );

  const rows: [string, React.ReactNode][] = [
    ["이름", user.name],
    ["이메일", user.email],
    ["역할", user.role],
    ["로그인 방식", user.id === "dev-bypass" ? "개발용 바이패스 (로컬)" : "Google 계정"],
    ["최근 로그인", fmt(row?.last_login_at)],
    ["계정 등록일", fmt(row?.created_at)],
    ["상태", row ? (row.is_active ? "활성" : "비활성") : "활성"],
  ];

  return (
    <>
      <PageHeader title="마이페이지" desc="내 계정 정보. 이름과 사진은 Google 계정을 따르고, 역할은 운영관리자가 지정합니다" />
      <div className="page-body">
        <div className="my-profile">
          <Avatar name={user.name} picture={user.picture} size={64} />
          <div>
            <div className="my-name">{user.name}</div>
            <div className="muted">{user.email}</div>
          </div>
        </div>

        <dl className="my-kv">
          {rows.map(([k, v]) => (
            <div key={k} className="kv-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="toolbar" style={{ marginTop: 24 }}>
          <a className="btn" href="/api/auth/logout">
            <Icon as={LogOut} />
            로그아웃
          </a>
        </div>
        <p className="faint" style={{ fontSize: 12, marginTop: 16 }}>
          역할 변경이나 계정 추가는 운영관리자에게 요청하세요. 계정은 D1 app_users 테이블에서 관리합니다.
        </p>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable } from "@/components/ui/DataTable";
import { formatEditedAt } from "@/lib/ax-progress";
import type { AppUserRow } from "@/lib/roles";

const ROLE_OPTS = [
  { value: "관리자", label: "관리자" },
  { value: "편집자", label: "편집자" },
];

export function UsersAdmin({ users, meId }: { users: AppUserRow[]; meId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("편집자");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(method: "POST" | "PATCH", body: unknown) {
    setBusy(true);
    setMsg("");
    const r = (await fetch("/api/admin/users", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (r.error) return setMsg(r.error);
    router.refresh();
    return true;
  }

  const rows = users.map((u) => ({
    ...u,
    name_text: u.name || "-",
    active_text: u.is_active ? "활성" : "차단",
    last_login: u.last_login_at ? formatEditedAt(u.last_login_at) : "-",
    created: u.created_at ? formatEditedAt(u.created_at) : "-",
    me: u.id === meId,
  }));

  return (
    <>
      <div className="stage-bar" style={{ margin: "0 0 16px", padding: 0 }}>
        <div className="sb-left" style={{ flexWrap: "wrap" }}>
          <input className="input" style={{ width: 240 }} placeholder="이메일 (Google 계정)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" style={{ width: 140 }} placeholder="이름 (선택)" value={name} onChange={(e) => setName(e.target.value)} />
          <Dropdown value={role} options={ROLE_OPTS} onChange={setRole} ariaLabel="역할" width={130} />
          <button
            type="button"
            className="btn primary"
            disabled={busy || !email.trim()}
            onClick={async () => {
              if (await call("POST", { email, name, role })) {
                setEmail("");
                setName("");
                setRole("편집자");
              }
            }}
          >
            <Icon as={Plus} />
            계정 추가
          </button>
          {msg && <span style={{ color: "var(--red)", fontSize: 13 }}>{msg}</span>}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 12px" }}>
        Google 로그인이 테스트 모드라 여기 추가한 뒤 Google Cloud 콘솔의 테스트 사용자에도 같은 이메일을 등록해야 로그인이 됩니다.
      </p>
      <DataTable
        rowKey="id"
        rows={rows}
        columns={[
          { key: "email", label: "이메일", type: "strong", flex: true },
          { key: "name_text", label: "이름", width: 120 },
          {
            key: "role",
            label: "역할",
            width: 200,
            sortable: true,
            render: (u) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span className={`badge ${u.role === "관리자" ? "blue" : "gray"}`}>{u.role}</span>
                {!u.me && (
                  <button
                    type="button"
                    className="tbl-link"
                    disabled={busy}
                    onClick={() => call("PATCH", { id: u.id, role: u.role === "관리자" ? "편집자" : "관리자" })}
                  >
                    {u.role === "관리자" ? "편집자로" : "관리자로"}
                  </button>
                )}
              </span>
            ),
          },
          {
            key: "active_text",
            label: "상태",
            width: 120,
            sortable: true,
            render: (u) =>
              u.me ? (
                <span className="badge green">활성 (나)</span>
              ) : (
                <button type="button" className="tbl-link" disabled={busy} onClick={() => call("PATCH", { id: u.id, is_active: !u.is_active })}>
                  {u.is_active ? "차단하기" : "다시 활성화"}
                </button>
              ),
          },
          { key: "last_login", label: "최근 로그인", type: "muted", sortKey: "last_login_at", width: 150 },
          { key: "created", label: "등록일", type: "muted", sortKey: "created_at", width: 150 },
        ]}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

/** 마이페이지 이름 인라인 편집. 저장하면 app_users와 세션 쿠키가 함께 바뀐다. */
export function NameEditor({ name }: { name: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const r = (await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: v }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (r.error) return setErr(r.error);
    setEdit(false);
    router.refresh();
  }

  if (!edit) {
    return (
      <span className="name-editor">
        <span className="my-name">{name}</span>
        <button type="button" className="tbl-link" onClick={() => setEdit(true)}>
          <Icon as={Pencil} size="sm" /> 이름 바꾸기
        </button>
      </span>
    );
  }
  return (
    <span className="name-editor">
      <input
        className="input"
        style={{ width: 200, height: 36, fontSize: 15, fontWeight: 600 }}
        value={v}
        maxLength={30}
        autoFocus
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEdit(false);
        }}
        aria-label="표시 이름"
      />
      <button type="button" className="btn primary" onClick={save} disabled={busy || !v.trim()}>
        <Icon as={Check} />
        저장
      </button>
      <button type="button" className="btn" onClick={() => setEdit(false)} disabled={busy}>
        취소
      </button>
      {err && <span className="field-error-text">{err}</span>}
    </span>
  );
}

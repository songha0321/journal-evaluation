"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

const COHORTS = [9, 8, 7, 6, 5];

export function AddIssueButton({ project = "2027 항해일지" }: { project?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [cohort, setCohort] = useState(9);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create() {
    if (!label.trim()) return setErr("호차명을 입력하세요.");
    setBusy(true);
    setErr("");
    const r = (await fetch("/api/ax/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project, issue_label: label.trim(), cohort }),
    }).then((x) => x.json())) as { issue_id?: string; error?: string };
    setBusy(false);
    if (r.issue_id) {
      setOpen(false);
      setLabel("");
      router.refresh();
    } else {
      setErr(r.error || "생성에 실패했습니다.");
    }
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)} type="button">
        <Plus size={15} strokeWidth={2} aria-hidden />
        호차 추가
      </button>
      <Modal
        open={open}
        title="호차 추가"
        sub={project}
        onClose={() => setOpen(false)}
        footer={
          <>
            {err && <span style={{ color: "var(--red)", fontSize: 13 }}>{err}</span>}
            <div className="spacer" />
            <button className="btn" onClick={() => setOpen(false)} type="button">
              취소
            </button>
            <button className="btn primary" onClick={create} disabled={busy} type="button">
              {busy ? "생성 중…" : "생성"}
            </button>
          </>
        }
      >
        <label className="field">
          <span className="flabel">
            호차명<span className="req">*</span>
            <span className="fhint">예: 1호차 · 2호차 · Final</span>
          </span>
          <input
            className="input"
            style={{ width: "100%", height: 40 }}
            value={label}
            placeholder="1호차"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </label>
        <label className="field">
          <span className="flabel">
            대상 기수<span className="fhint">선별 후보 풀의 범위</span>
          </span>
          <select
            className="select"
            style={{ width: "100%", height: 40 }}
            value={cohort}
            onChange={(e) => setCohort(Number(e.target.value))}
          >
            {COHORTS.map((c) => (
              <option key={c} value={c}>
                {c}기
              </option>
            ))}
          </select>
        </label>
      </Modal>
    </>
  );
}

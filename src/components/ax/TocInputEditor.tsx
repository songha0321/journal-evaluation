"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2, TriangleAlert, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CharTextarea } from "@/components/ui/CharTextarea";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Toc } from "@/lib/ax";

interface Row {
  id: string;
  part_no: string;
  chapter_no: string;
  title: string;
  toc_content: string;
  hanmadi: string;
  select_count: number;
  shortlisted_at: string | null;
}

function toRow(t: Toc): Row {
  return {
    id: t.id,
    part_no: t.part_no?.toString() ?? "",
    chapter_no: t.chapter_no?.toString() ?? "",
    title: t.title === "제목 없음" ? "" : t.title,
    toc_content: t.toc_content ?? "",
    hanmadi: t.hanmadi ?? "",
    select_count: t.select_count,
    shortlisted_at: t.shortlisted_at,
  };
}

function rowLabel(r: Row): string {
  const seg = [r.part_no ? `Part ${r.part_no}` : "", r.chapter_no ? `Chapter ${r.chapter_no}` : ""]
    .filter(Boolean)
    .join(" ");
  return seg ? `${seg}. ${r.title || "(목차명 미입력)"}` : r.title || "(목차명 미입력)";
}

/** 목차 1건이 AI 선별을 시작할 수 있는 상태인지 — 모든 필드가 필수다. */
function missingFields(r: Row): string[] {
  const miss: string[] = [];
  if (!r.part_no.trim()) miss.push("Part");
  if (!r.title.trim()) miss.push("목차명");
  if (!r.toc_content.trim()) miss.push("목차내용");
  if (!r.hanmadi.trim()) miss.push("한마디");
  if (!r.select_count || r.select_count < 1) miss.push("선별 개수");
  return miss;
}

export function TocInputEditor({ issueId, initial }: { issueId: string; initial: Toc[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState<{ done: number; total: number; label: string } | null>(null);
  const [err, setErr] = useState("");

  const blocking = useMemo(() => rows.flatMap((r) => missingFields(r).map((f) => ({ r, f }))), [rows]);
  const canStart = rows.length > 0 && blocking.length === 0 && !running;

  function patch(id: string, delta: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...delta } : r)));
  }

  async function save(r: Row) {
    await fetch("/api/ax/toc", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: r.id,
        part_no: r.part_no ? Number(r.part_no) : null,
        chapter_no: r.chapter_no ? Number(r.chapter_no) : null,
        title: r.title.trim() || "제목 없음",
        toc_content: r.toc_content,
        hanmadi: r.hanmadi,
        select_count: r.select_count,
      }),
    });
  }

  async function addToc() {
    const r = (await fetch("/api/ax/toc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issue_id: issueId, select_count: 10 }),
    }).then((x) => x.json())) as { toc_id?: string };
    if (!r.toc_id) return;
    setRows((prev) => [
      ...prev,
      {
        id: r.toc_id!,
        part_no: "",
        chapter_no: "",
        title: "",
        toc_content: "",
        hanmadi: "",
        select_count: 10,
        shortlisted_at: null,
      },
    ]);
  }

  async function removeToc(id: string) {
    await fetch(`/api/ax/toc?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  /** 목차를 하나씩 순차 처리한다. 목차 수가 곧 진행률의 분모가 된다. */
  async function startShortlist() {
    setConfirmOpen(false);
    setErr("");
    for (const r of rows) await save(r);

    for (let i = 0; i < rows.length; i++) {
      setRunning({ done: i, total: rows.length, label: rowLabel(rows[i]) });
      const res = (await fetch("/api/ax/shortlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toc_id: rows[i].id }),
      })
        .then((x) => x.json())
        .catch(() => ({ error: "네트워크 오류" }))) as { error?: string };
      if (res.error) {
        setRunning(null);
        setErr(`‘${rowLabel(rows[i])}’ 선별 실패: ${res.error}`);
        return;
      }
    }
    setRunning({ done: rows.length, total: rows.length, label: "완료" });
    router.push(`/ax/issues/${issueId}/ai-select`);
    router.refresh();
  }

  return (
    <div className="page-body">
      {/* GNB 바로 밑 — AI 수기 선별 시작 */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button
          className="btn primary"
          onClick={() => (canStart ? setConfirmOpen(true) : setTouched(true))}
          disabled={!!running}
          aria-disabled={!canStart}
          style={!canStart ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
          type="button"
        >
          <Sparkles size={15} strokeWidth={2} aria-hidden />
          {running ? "AI 수기 선별 진행 중…" : "AI 수기 선별 시작"}
        </button>
        <button className="btn" onClick={addToc} disabled={!!running} type="button">
          <Plus size={15} strokeWidth={2} aria-hidden />
          목차 추가
        </button>
        <span className="faint">목차 {rows.length}개</span>
      </div>

      {running && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="toolbar" style={{ marginBottom: 8, justifyContent: "space-between" }}>
            <b>AI 수기 선별 진행 중</b>
            <span className="faint">
              {running.done} / {running.total} 목차 · 현재: {running.label}
            </span>
          </div>
          <ProgressBar pct={Math.round((running.done / Math.max(1, running.total)) * 100)} />
          <p className="faint" style={{ margin: "8px 0 0", fontSize: 12 }}>
            수기 분량이 많아 목차당 수 분이 걸릴 수 있습니다. 이 화면을 닫지 마세요.
          </p>
        </div>
      )}

      {err && (
        <div className="alert error">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          {err}
        </div>
      )}

      {touched && blocking.length > 0 && (
        <div className="alert warn">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          비어 있는 필드가 {blocking.length}개 있습니다. 모든 항목을 입력해야 AI 수기 선별을 시작할 수 있습니다.
        </div>
      )}

      {rows.length === 0 && (
        <div className="empty">목차가 없습니다. ‘목차 추가’로 첫 목차를 만드세요.</div>
      )}

      {rows.map((r) => (
        <div className="card" key={r.id} style={{ marginBottom: 14 }}>
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <b style={{ fontSize: 15 }}>{rowLabel(r)}</b>
            <span className="toolbar" style={{ margin: 0, gap: 8 }}>
              {r.shortlisted_at && (
                <span className="badge green">
                  <Check size={12} strokeWidth={3} aria-hidden />
                  선별 완료
                </span>
              )}
              <button
                className="btn"
                onClick={() => removeToc(r.id)}
                disabled={!!running}
                title="목차 삭제"
                type="button"
              >
                <Trash2 size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "90px 90px 1fr 120px", gap: 10, marginBottom: 4 }}>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="flabel">
                Part<span className="req">*</span>
              </span>
              <input
                className="input"
                style={{ width: "100%", height: 40 }}
                value={r.part_no}
                inputMode="numeric"
                onChange={(e) => patch(r.id, { part_no: e.target.value.replace(/\D/g, "") })}
                onBlur={() => save({ ...r })}
              />
            </label>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="flabel">Chapter</span>
              <input
                className="input"
                style={{ width: "100%", height: 40 }}
                value={r.chapter_no}
                inputMode="numeric"
                placeholder="없음"
                onChange={(e) => patch(r.id, { chapter_no: e.target.value.replace(/\D/g, "") })}
                onBlur={() => save({ ...r })}
              />
            </label>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="flabel">
                목차명<span className="req">*</span>
              </span>
              <input
                className="input"
                style={{ width: "100%", height: 40 }}
                value={r.title}
                placeholder="상반기 공부법"
                onChange={(e) => patch(r.id, { title: e.target.value })}
                onBlur={() => save({ ...r })}
              />
            </label>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="flabel">
                선별 개수<span className="req">*</span>
              </span>
              <input
                className="input"
                style={{ width: "100%", height: 40 }}
                type="number"
                min={1}
                value={r.select_count}
                onChange={(e) => patch(r.id, { select_count: Number(e.target.value) })}
                onBlur={() => save({ ...r })}
              />
            </label>
          </div>

          <div onBlur={() => save({ ...r })}>
            <CharTextarea
              label="목차내용"
              hint="AI 선별의 기준입니다. 글자수 제한 없이 자세히 작성하세요."
              required
              showError={touched}
              value={r.toc_content}
              onChange={(v) => patch(r.id, { toc_content: v })}
              placeholder="예: 과목별 상반기 공부법과 6평 전후 피드백 방법"
              minHeight={140}
            />
            <CharTextarea
              label="한마디"
              hint="원고 export에 노출됩니다."
              required
              showError={touched}
              value={r.hanmadi}
              onChange={(v) => patch(r.id, { hanmadi: v })}
              placeholder="이 파트에서 다루는 세부 주제와 수기 구성을 안내하는 문장"
              minHeight={110}
            />
          </div>

          {touched && missingFields(r).length > 0 && (
            <div className="field-error">
              <TriangleAlert size={13} strokeWidth={2} aria-hidden />
              미입력: {missingFields(r).join(" · ")}
            </div>
          )}
        </div>
      ))}

      <Modal
        open={confirmOpen}
        title="이대로 목차를 확정하겠습니까?"
        sub="확정하면 입력한 목차내용을 기준으로 AI 수기 선별이 시작됩니다."
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <div className="spacer" />
            <button className="btn" onClick={() => setConfirmOpen(false)} type="button">
              취소
            </button>
            <button className="btn primary" onClick={startShortlist} type="button">
              확인
            </button>
          </>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          목차 {rows.length}개에 대해 순차적으로 선별합니다. 이미 다른 호차·목차에 실린 수기는 자동으로 제외됩니다.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          {rows.map((r) => (
            <li key={r.id}>
              {rowLabel(r)} <span className="faint">— {r.select_count}개 선별</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

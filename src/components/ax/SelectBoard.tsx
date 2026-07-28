"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, TriangleAlert, Users, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { Candidate, Toc } from "@/lib/ax";
import { tocLabel } from "@/lib/ax";

const CONF_LABEL: Record<string, string> = { high: "적합도 높음", medium: "적합도 보통", low: "적합도 낮음" };
const CONF_TONE: Record<string, string> = { high: "green", medium: "blue", low: "gray" };

interface Props {
  issueId: string;
  tocs: Toc[];
  /** 목차별 후보. 서버에서 요청 개수만큼만 잘라 내려준다. */
  candidates: Record<string, Candidate[]>;
  /** 목차별 이미 확정된 qna_id */
  confirmed: Record<string, string[]>;
}

export function SelectBoard({ issueId, tocs, candidates, confirmed }: Props) {
  const router = useRouter();
  const [openToc, setOpenToc] = useState<Toc | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const allConfirmed = tocs.length > 0 && tocs.every((t) => (t.ms_count ?? 0) > 0);

  function open(t: Toc) {
    const init: Record<string, boolean> = {};
    const already = confirmed[t.id] ?? [];
    if (already.length) {
      already.forEach((q) => (init[q] = true));
    } else {
      // 최초 진입: AI가 적합하다고 본 것(high/medium)을 요청 개수만큼 미리 체크해 둔다.
      (candidates[t.id] ?? [])
        .filter((c) => c.confidence !== "low")
        .slice(0, t.select_count)
        .forEach((c) => (init[c.qna_id] = true));
    }
    setPicked(init);
    setMsg("");
    setOpenToc(t);
  }

  const pickedIds = Object.keys(picked).filter((k) => picked[k]);

  async function confirm() {
    if (!openToc) return;
    setBusy(true);
    const r = (await fetch("/api/ax/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toc_id: openToc.id, qna_ids: pickedIds }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { confirmed?: number; skipped?: string[]; error?: string };
    setBusy(false);
    if (r.error) return setMsg(r.error);
    setOpenToc(null);
    router.refresh();
  }

  return (
    <div className="page-body">
      <div className="toolbar" style={{ marginBottom: 14, justifyContent: "space-between" }}>
        <span className="faint">
          목차 {tocs.length}개 · 확정 완료 {tocs.filter((t) => (t.ms_count ?? 0) > 0).length}개
        </span>
        <button
          className="btn primary"
          disabled={!allConfirmed}
          aria-disabled={!allConfirmed}
          title={allConfirmed ? "" : "모든 목차의 수기를 확정해야 활성화됩니다."}
          onClick={() => router.push(`/ax/issues/${issueId}/revise`)}
          type="button"
        >
          최종 확정 → AI 원고 탈고
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {tocs.length === 0 ? (
        <div className="empty">목차가 없습니다. [목차 입력]에서 먼저 목차를 만드세요.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>목차</th>
                <th>목차내용</th>
                <th className="num">후보</th>
                <th className="num">확정</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tocs.map((t) => {
                const cands = candidates[t.id] ?? [];
                const done = (t.ms_count ?? 0) > 0;
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{tocLabel(t)}</td>
                    <td
                      className="muted"
                      style={{
                        maxWidth: 340,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={t.toc_content ?? ""}
                    >
                      {t.toc_content || "-"}
                    </td>
                    <td className="num">{cands.length}</td>
                    <td className="num">
                      {t.ms_count ?? 0} / {t.select_count}
                    </td>
                    <td>
                      {done ? (
                        <span className="badge green">
                          <Check size={12} strokeWidth={3} aria-hidden />
                          확정
                        </span>
                      ) : t.shortlisted_at ? (
                        <span className="badge blue">확정 대기</span>
                      ) : (
                        <span className="badge gray">선별 전</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn"
                        onClick={() => open(t)}
                        disabled={!t.shortlisted_at}
                        title={t.shortlisted_at ? "" : "AI 수기 선별이 끝나야 후보를 볼 수 있습니다."}
                        type="button"
                      >
                        후보 검토
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!openToc}
        wide
        title={openToc ? tocLabel(openToc) : ""}
        sub={openToc?.toc_content ?? undefined}
        onClose={() => setOpenToc(null)}
        footer={
          <>
            {msg && <span style={{ color: "var(--red)", fontSize: 13 }}>{msg}</span>}
            <span className="faint">
              {pickedIds.length} / {openToc?.select_count ?? 0} 선택
            </span>
            <div className="spacer" />
            <button className="btn" onClick={() => setOpenToc(null)} type="button">
              취소
            </button>
            <button className="btn primary" onClick={confirm} disabled={busy} type="button">
              {busy ? "확정 중…" : "확정하기"}
            </button>
          </>
        }
      >
        {openToc && (candidates[openToc.id] ?? []).length === 0 ? (
          <div className="empty">후보가 없습니다.</div>
        ) : (
          openToc &&
          (candidates[openToc.id] ?? []).map((c) => (
            <label
              key={c.qna_id}
              className={`cand conf-${c.confidence ?? "low"}${picked[c.qna_id] ? " picked" : ""}`}
            >
              <span>
                <input
                  type="checkbox"
                  checked={!!picked[c.qna_id]}
                  onChange={(e) => setPicked({ ...picked, [c.qna_id]: e.target.checked })}
                />
                <span className="c-rank" style={{ display: "block", marginTop: 6 }}>
                  {c.rank ?? "-"}
                </span>
              </span>
              <span>
                <div className="c-q">
                  {c.question_key ? `[${c.question_key}] ` : ""}
                  {c.question_text}
                </div>
                <div className="c-a">{c.answer_text}</div>

                <div className="c-meta">
                  <span className={`badge ${CONF_TONE[c.confidence ?? "low"]}`}>
                    {CONF_LABEL[c.confidence ?? "low"]}
                  </span>
                  <span className="badge gray">적합성 {c.fit_score ?? "-"}/5</span>
                  {c.duplicate_warning === 1 && (
                    <span className="badge amber">
                      <TriangleAlert size={11} strokeWidth={2} aria-hidden />
                      유사 내용 주의
                    </span>
                  )}
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    <Users size={12} strokeWidth={1.75} aria-hidden />
                    {c.name}
                  </span>
                  <span>{c.student_type || "-"}</span>
                  <span>{c.final_university || "대학 미입력"}</span>
                  <span>평가 {c.total_score ?? "-"}</span>
                </div>

                {c.reason && (
                  <div className="c-reason">
                    <Sparkles size={12} strokeWidth={1.75} aria-hidden style={{ marginRight: 4 }} />
                    {c.reason}
                  </div>
                )}
              </span>
            </label>
          ))
        )}
      </Modal>
    </div>
  );
}

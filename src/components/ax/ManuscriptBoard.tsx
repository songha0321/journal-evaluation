"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Download, Check, TriangleAlert, Pencil, X } from "lucide-react";
import { CharTextarea } from "@/components/ui/CharTextarea";
import { RunnerNotice, type RunnerInfo } from "@/components/ax/RunnerNotice";
import { Modal } from "@/components/ui/Modal";
import type { Manuscript, Toc } from "@/lib/ax";
import { formatEditedAt } from "@/lib/ax-progress";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "수기 확정", tone: "gray" },
  edited: { label: "저장됨", tone: "blue" },
  final: { label: "확정됨", tone: "green" },
};

const REVISE_META: Record<string, { label: string; tone: string }> = {
  queued: { label: "탈고 요청됨", tone: "blue" },
  running: { label: "탈고 중", tone: "accent" },
  error: { label: "탈고 실패", tone: "red" },
};

interface QueueRow {
  id: string;
  revise_status: string;
  revise_error: string | null;
  status: string;
  updated_at: string;
}

export function ManuscriptBoard({ toc, manuscripts }: { toc: Toc; manuscripts: Manuscript[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [tocContent, setTocContent] = useState(toc.toc_content ?? "");
  const [hanmadi, setHanmadi] = useState(toc.hanmadi ?? "");
  const [queue, setQueue] = useState<{ rows: QueueRow[]; runner: RunnerInfo | null } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = manuscripts.length;
  const finals = manuscripts.filter((m) => m.status === "final").length;
  const withSubtitle = manuscripts.filter((m) => m.subtitle?.trim()).length;
  const reviews = manuscripts.filter((m) => m.needs_review === 1).length;

  // 소제목은 목차 전체가 같은 상태여야 한다 — 전부 입력 또는 전부 미입력.
  const subtitleMixed = withSubtitle !== 0 && withSubtitle !== total;
  const canFinalize = total > 0 && finals === total && !subtitleMixed && reviews === 0;
  const canDownload = Boolean(toc.finalized_at);
  const busyRevise = queue?.rows.some((r) => r.revise_status === "queued" || r.revise_status === "running") ?? false;

  const poll = useCallback(async () => {
    const r = (await fetch(`/api/ax/revise?toc_id=${encodeURIComponent(toc.id)}`)
      .then((x) => x.json())
      .catch(() => null)) as { manuscripts?: QueueRow[]; runner?: RunnerInfo } | null;
    if (!r?.manuscripts) return;
    const active = r.manuscripts.some((m) => m.revise_status === "queued" || m.revise_status === "running");
    setQueue({ rows: r.manuscripts, runner: r.runner ?? null });
    if (!active && busyRevise) router.refresh();
  }, [toc.id, busyRevise, router]);

  useEffect(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    if (!busyRevise) {
      if (polling.current) clearInterval(polling.current);
      polling.current = null;
      return;
    }
    polling.current = setInterval(() => void poll(), 5000);
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, [busyRevise, poll]);

  async function saveToc() {
    await fetch("/api/ax/toc", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: toc.id, toc_content: tocContent, hanmadi }),
    });
    setEditOpen(false);
    router.refresh();
  }

  async function runRevise() {
    setBusy("revise");
    setMsg("");
    const r = (await fetch("/api/ax/revise", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toc_id: toc.id }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { queued?: number; error?: string };
    setBusy("");
    if (r.error) return setMsg(r.error);
    void poll();
  }

  async function finalize() {
    setBusy("finalize");
    setMsg("");
    const r = (await fetch("/api/ax/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toc_id: toc.id }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { ok?: boolean; error?: string };
    setBusy("");
    if (r.error) return setMsg(r.error);
    router.refresh();
  }

  const reviseOf = (id: string) => queue?.rows.find((r) => r.id === id)?.revise_status;

  return (
    <div className="page-body">
      {/* 목차내용 · 한마디 — 여기서 고치면 [목차 입력] 노출값도 함께 바뀐다 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <b>목차 정보</b>
          <button className="btn" onClick={() => setEditOpen(true)} type="button">
            <Pencil size={14} strokeWidth={1.75} aria-hidden />
            수정
          </button>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "72px 1fr" }}>
          <dt>목차내용</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>{toc.toc_content || <span className="faint">미입력</span>}</dd>
          <dt>한마디</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>{toc.hanmadi || <span className="faint">미입력</span>}</dd>
        </dl>
      </div>

      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <span className="faint">
          선별 원고 {total}개 · 확정 {finals}/{total}
        </span>
        <span className="toolbar" style={{ margin: 0 }}>
          <button className="btn" onClick={runRevise} disabled={!!busy || busyRevise || total === 0} type="button">
            <Sparkles size={15} strokeWidth={2} aria-hidden />
            {busyRevise ? "AI 탈고 진행 중…" : "AI 원고 탈고 실행"}
          </button>
          <button
            className="btn primary"
            onClick={finalize}
            disabled={!canFinalize || !!busy || Boolean(toc.finalized_at)}
            aria-disabled={!canFinalize}
            title={canFinalize ? "" : "모든 원고가 확정되어야 활성화됩니다."}
            type="button"
          >
            <Check size={15} strokeWidth={2} aria-hidden />
            {toc.finalized_at ? "원고 확정됨" : "원고 확정"}
          </button>
          <a
            className="btn"
            href={canDownload ? `/api/ax/export/${toc.id}` : undefined}
            aria-disabled={!canDownload}
            title={canDownload ? "" : "‘원고 확정’ 후 다운로드할 수 있습니다."}
            style={!canDownload ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <Download size={15} strokeWidth={2} aria-hidden />
            원고 다운로드
          </a>
        </span>
      </div>

      {msg && (
        <div className="alert error">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          {msg}
        </div>
      )}
      {subtitleMixed && (
        <div className="alert warn">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          소제목이 일부에만 입력되어 있습니다 ({withSubtitle}/{total}). 목차 안에서는 전부 입력하거나 전부 비워야
          합니다.
        </div>
      )}
      {busyRevise && <RunnerNotice runner={queue?.runner} />}

      {total === 0 ? (
        <div className="empty">확정된 수기가 없습니다. [AI 수기 선별]에서 먼저 확정하세요.</div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>소제목</th>
                <th>이름</th>
                <th>최종대학</th>
                <th>comment</th>
                <th>상태</th>
                <th>최종 편집 일시</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {manuscripts.map((m) => {
                const rev = reviseOf(m.id);
                const st = STATUS_META[m.status] ?? { label: m.status, tone: "gray" };
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600, maxWidth: 220 }}>
                      {m.subtitle?.trim() ? m.subtitle : <span className="faint">미입력</span>}
                    </td>
                    <td>{m.name}</td>
                    <td className="muted">{m.final_university || "-"}</td>
                    <td
                      className="muted"
                      style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={m.comment ?? ""}
                    >
                      {m.comment?.trim() ? m.comment : <span className="faint">미작성</span>}
                    </td>
                    <td>
                      <span className="toolbar" style={{ margin: 0, gap: 4 }}>
                        <span className={`badge ${st.tone}`}>{st.label}</span>
                        {rev && REVISE_META[rev] && (
                          <span className={`badge ${REVISE_META[rev].tone}`}>{REVISE_META[rev].label}</span>
                        )}
                        {m.needs_review === 1 && (
                          <span className="badge amber">
                            <TriangleAlert size={11} strokeWidth={2} aria-hidden />
                            검수 필요
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="muted">{formatEditedAt(m.updated_at)}</td>
                    <td>
                      <Link className="row-link" href={`/ax/toc/${toc.id}/${m.id}`}>
                        편집 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editOpen}
        title="목차 정보 수정"
        sub="여기서 고치면 [목차 입력] 화면의 값도 함께 바뀝니다."
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <div className="spacer" />
            <button className="btn" onClick={() => setEditOpen(false)} type="button">
              <X size={14} strokeWidth={2} aria-hidden />
              취소
            </button>
            <button className="btn primary" onClick={saveToc} type="button">
              저장
            </button>
          </>
        }
      >
        <CharTextarea label="목차내용" value={tocContent} onChange={setTocContent} minHeight={140} />
        <CharTextarea label="한마디" value={hanmadi} onChange={setHanmadi} minHeight={110} />
      </Modal>
    </div>
  );
}

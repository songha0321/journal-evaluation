"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Download, Check, TriangleAlert, Pencil, X } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
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
            <Icon as={Pencil} />
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
          선별 원고 {total}개, 확정 {finals}/{total}
        </span>
        <span className="toolbar" style={{ margin: 0 }}>
          <button className="btn" onClick={runRevise} disabled={!!busy || busyRevise || total === 0} type="button">
            <Icon as={Sparkles} />
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
            <Icon as={Check} />
            {toc.finalized_at ? "원고 확정됨" : "원고 확정"}
          </button>
          <a
            className="btn"
            href={canDownload ? `/api/ax/export/${toc.id}` : undefined}
            aria-disabled={!canDownload}
            title={canDownload ? "" : "‘원고 확정’ 후 다운로드할 수 있습니다."}
            style={!canDownload ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <Icon as={Download} />
            원고 다운로드
          </a>
        </span>
      </div>

      {msg && (
        <div className="alert error">
          <Icon as={TriangleAlert} />
          {msg}
        </div>
      )}
      {subtitleMixed && (
        <div className="alert warn">
          <Icon as={TriangleAlert} />
          소제목이 일부에만 입력되어 있습니다 ({withSubtitle}/{total}). 목차 안에서는 전부 입력하거나 전부 비워야
          합니다.
        </div>
      )}
      {busyRevise && <RunnerNotice runner={queue?.runner} />}

      {total === 0 ? (
        <div className="empty">확정된 수기가 없습니다. [AI 수기 선별]에서 먼저 확정하세요.</div>
      ) : (
        <DataTable
          rowKey="id"
          rows={manuscripts}
          style={{ marginTop: 12 }}
          columns={[
            {
              key: "subtitle",
              label: "소제목",
              type: "strong",
              sortable: true,
              render: (m) => (m.subtitle?.trim() ? <span className="clip" style={{ maxWidth: 220 }}>{m.subtitle}</span> : <span className="faint">미입력</span>),
            },
            { key: "name", label: "이름", width: 90 },
            { key: "final_university", label: "최종대학", type: "clip", maxWidth: 160 },
            {
              key: "comment",
              label: "comment",
              type: "clip",
              maxWidth: 280,
              render: (m) => (m.comment?.trim() ? <span className="clip" title={m.comment}>{m.comment}</span> : <span className="faint">미작성</span>),
              sortable: true,
            },
            {
              key: "status",
              label: "상태",
              sortable: true,
              render: (m) => {
                const rev = reviseOf(m.id);
                const st = STATUS_META[m.status] ?? { label: m.status, tone: "gray" };
                return (
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    <span className={`badge ${st.tone}`}>{st.label}</span>
                    {rev && REVISE_META[rev] && <span className={`badge ${REVISE_META[rev].tone}`}>{REVISE_META[rev].label}</span>}
                    {m.needs_review === 1 && (
                      <span className="badge amber">
                        <Icon as={TriangleAlert} size="sm" />
                        검수 필요
                      </span>
                    )}
                  </span>
                );
              },
            },
            { key: "updated_at", label: "최종 편집 일시", type: "muted", width: 150, render: (m) => <span className="muted">{formatEditedAt(m.updated_at)}</span>, sortable: true },
            {
              key: "edit",
              label: "",
              width: 80,
              render: (m) => (
                <Link className="tbl-link" href={`/ax/toc/${toc.id}/${m.id}`}>
                  편집
                </Link>
              ),
            },
          ]}
        />
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
              <Icon as={X} />
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

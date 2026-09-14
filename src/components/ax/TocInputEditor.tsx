"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert, Check, ArrowRight, BookOpen } from "lucide-react";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { StageBar } from "@/components/ax/StageBar";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { CharTextarea } from "@/components/ui/CharTextarea";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RunnerNotice, type RunnerInfo } from "@/components/ax/RunnerNotice";
import type { Toc } from "@/lib/ax";

interface QueueRow {
  id: string;
  title: string;
  shortlist_status: string;
  shortlist_progress: string | null;
  shortlist_error: string | null;
}

interface QueueState {
  rows: QueueRow[];
  runner: RunnerInfo | null;
  active: boolean;
}

const QUEUE_LABEL: Record<string, string> = {
  idle: "대기",
  queued: "요청됨",
  running: "선별 중",
  done: "완료",
  error: "실패",
};
const QUEUE_TONE: Record<string, string> = {
  idle: "gray",
  queued: "blue",
  running: "accent",
  done: "green",
  error: "red",
};

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [err, setErr] = useState("");
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 이 화면에서 실행 중(queued/running)인 것을 본 적이 있을 때만, 끝나면 다음 화면으로 넘긴다.
   *  처음 열자마자 넘겨 버리면 완료된 1단계를 다시 볼 수 없다(2026-09-14 버그). */
  const sawActive = useRef(false);

  const running = queue?.active ?? null;

  const blocking = useMemo(() => rows.flatMap((r) => missingFields(r).map((f) => ({ r, f }))), [rows]);
  const canStart = rows.length > 0 && blocking.length === 0 && !running;

  /** 큐 상태 폴링. 이 화면에서 시작한 선별이 모두 끝나면 [AI 수기 선별] 화면으로 넘긴다. */
  const poll = useCallback(async () => {
    const r = (await fetch(`/api/ax/shortlist?issue_id=${encodeURIComponent(issueId)}`)
      .then((x) => x.json())
      .catch(() => null)) as { tocs?: QueueRow[]; runner?: QueueState["runner"] } | null;
    if (!r?.tocs) return;
    const active = r.tocs.some((t) => t.shortlist_status === "queued" || t.shortlist_status === "running");
    setQueue({ rows: r.tocs, runner: r.runner ?? null, active });
    if (active) sawActive.current = true;
    if (!active && sawActive.current && r.tocs.some((t) => t.shortlist_status === "done")) {
      sawActive.current = false;
      router.push(`/ax/issues/${issueId}/ai-select`);
      router.refresh();
    }
  }, [issueId, router]);

  useEffect(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    if (!running) {
      if (polling.current) clearInterval(polling.current);
      polling.current = null;
      return;
    }
    polling.current = setInterval(() => void poll(), 5000);
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, [running, poll]);

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

  /** 순서 변경 = 이웃 목차와 Part·Chapter 번호를 맞바꾸고 둘 다 저장한다(정렬 기준이 번호이므로). */
  async function moveToc(id: string, dir: -1 | 1) {
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const a = rows[i];
    const b = rows[j];
    const a2 = { ...a, part_no: b.part_no, chapter_no: b.chapter_no };
    const b2 = { ...b, part_no: a.part_no, chapter_no: a.chapter_no };
    const next = [...rows];
    next[i] = b2;
    next[j] = a2;
    setRows(next);
    await Promise.all([save(a2), save(b2)]);
    router.refresh();
  }

  async function removeToc(id: string) {
    await fetch(`/api/ax/toc?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  /**
   * 선별 '요청'만 보낸다. 실제 실행은 로컬 러너(scripts/ax-runner.mjs)가 큐에서 가져간다.
   * 배포된 Worker는 CLI를 실행할 수 없으므로 여기서 LLM이 돌지 않는다.
   */
  async function startShortlist() {
    setConfirmOpen(false);
    setErr("");
    for (const r of rows) await save(r);

    const res = (await fetch("/api/ax/shortlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toc_ids: rows.map((r) => r.id) }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { queued?: number; error?: string };

    if (res.error) return setErr(res.error);
    poll();
  }

  return (
    <div className="page-body">
      <StageBar
        left={
          <>
            <span className="faint">목차 {rows.length}개</span>
            <button className="btn" onClick={addToc} disabled={!!running} type="button">
              <Icon as={Plus} />
              목차 추가
            </button>
            <button className="btn" onClick={() => setPreviewOpen(true)} disabled={rows.length === 0} type="button">
              <Icon as={BookOpen} />
              목차 미리보기
            </button>
          </>
        }
        right={
          <button
            className="btn primary"
            onClick={() => (canStart ? setConfirmOpen(true) : setTouched(true))}
            disabled={!!running}
            aria-disabled={!canStart}
            style={!canStart ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            type="button"
          >
            {running ? "AI 수기 선별 진행 중…" : "AI 수기 선별 시작"}
            <Icon as={ArrowRight} />
          </button>
        }
      />

      {queue && running && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="toolbar" style={{ marginBottom: 8, justifyContent: "space-between" }}>
            <b>AI 수기 선별 진행 중</b>
            <span className="faint">
              {queue.rows.filter((t) => t.shortlist_status === "done").length} / {queue.rows.length} 목차 완료
            </span>
          </div>
          <ProgressBar
            pct={Math.round(
              (queue.rows.filter((t) => t.shortlist_status === "done").length /
                Math.max(1, queue.rows.length)) *
                100,
            )}
          />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {queue.rows.map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                <span className={`badge ${QUEUE_TONE[t.shortlist_status] ?? "gray"}`}>
                  {QUEUE_LABEL[t.shortlist_status] ?? t.shortlist_status}
                </span>
                <span style={{ flex: 1 }}>{t.title}</span>
                <span className="faint">{t.shortlist_progress ?? ""}</span>
                {t.shortlist_error && <span style={{ color: "var(--red)" }}>{t.shortlist_error}</span>}
              </div>
            ))}
          </div>
          <RunnerNotice runner={queue.runner} />
        </div>
      )}

      {err && (
        <div className="alert error">
          <Icon as={TriangleAlert} />
          {err}
        </div>
      )}

      {touched && blocking.length > 0 && (
        <div className="alert warn">
          <Icon as={TriangleAlert} />
          비어 있는 필드가 {blocking.length}개 있습니다. 모든 항목을 입력해야 AI 수기 선별을 시작할 수 있습니다.
        </div>
      )}

      {rows.length === 0 && (
        <div className="empty">목차가 없습니다. ‘목차 추가’로 첫 목차를 만드세요.</div>
      )}

      {rows.map((r, idx) => (
        <div className="toc-card" key={r.id}>
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <b style={{ fontSize: 15 }}>{rowLabel(r)}</b>
            <span className="toolbar" style={{ margin: 0, gap: 8 }}>
              {r.shortlisted_at && (
                <span className="badge green">
                  <Icon as={Check} size="sm" />
                  선별 완료
                </span>
              )}
              <KebabMenu
                label="목차 메뉴"
                disabled={!!running}
                items={[
                  { label: "위로 이동", onSelect: () => moveToc(r.id, -1), disabled: idx === 0 },
                  { label: "아래로 이동", onSelect: () => moveToc(r.id, 1), disabled: idx === rows.length - 1 },
                  { label: "삭제", onSelect: () => removeToc(r.id), danger: true },
                ]}
              />
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
              minHeight={88}
            />
            <CharTextarea
              label="한마디"
              hint="원고 export에 노출됩니다."
              required
              showError={touched}
              value={r.hanmadi}
              onChange={(v) => patch(r.id, { hanmadi: v })}
              placeholder="이 파트에서 다루는 세부 주제와 수기 구성을 안내하는 문장"
              minHeight={88}
            />
          </div>

          {touched && missingFields(r).length > 0 && (
            <div className="field-error">
              <Icon as={TriangleAlert} size="sm" />
              미입력: {missingFields(r).join(", ")}
            </div>
          )}
        </div>
      ))}

      <Modal open={previewOpen} title="목차 미리보기" sub="지면에 실릴 순서대로. 번호가 비면 맨 뒤에 놓입니다." onClose={() => setPreviewOpen(false)}>
        <TocPreview rows={rows} />
      </Modal>

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
          목차 {rows.length}개를 선별 큐에 넣습니다. 실제 선별은 로컬 러너가 순차적으로 처리하며, 이미 다른
          호차나 목차에 실린 수기는 자동으로 제외됩니다.
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


/** 책 목차 모양 미리보기: Part로 묶고 Chapter 순으로. 한마디와 선별 개수를 함께 보여준다. */
function TocPreview({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => {
    const pa = a.part_no.trim() ? Number(a.part_no) : Infinity;
    const pb = b.part_no.trim() ? Number(b.part_no) : Infinity;
    if (pa !== pb) return pa - pb;
    const ca = a.chapter_no.trim() ? Number(a.chapter_no) : Infinity;
    const cb = b.chapter_no.trim() ? Number(b.chapter_no) : Infinity;
    return ca - cb;
  });
  const parts = new Map<string, Row[]>();
  for (const r of sorted) {
    const key = r.part_no.trim() ? `Part ${r.part_no}` : "Part 미지정";
    parts.set(key, [...(parts.get(key) ?? []), r]);
  }
  const total = rows.reduce((s, r) => s + (Number(r.select_count) || 0), 0);
  return (
    <div className="toc-preview">
      {[...parts.entries()].map(([part, list]) => (
        <section key={part} className="tp-part">
          <h3>{part}</h3>
          <ol>
            {list.map((r) => (
              <li key={r.id}>
                <div className="tp-title">
                  {r.chapter_no.trim() ? <span className="tp-ch">Chapter {r.chapter_no}.</span> : null}
                  {r.title.trim() || <span className="faint">(목차명 미입력)</span>}
                  <span className="tp-count">수기 {r.select_count || 0}편</span>
                </div>
                {r.hanmadi.trim() && <p className="tp-hanmadi">{r.hanmadi}</p>}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
        목차 {rows.length}개, 수기 {total}편 예정
      </p>
    </div>
  );
}

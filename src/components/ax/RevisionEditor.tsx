"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Underline, Save, TriangleAlert, X, Pencil, Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { KIND_META, applyEdits, isStale, type RevisionEdit } from "@/lib/revision";
import { formatEditedAt } from "@/lib/ax-progress";

interface Props {
  id: string;
  tocId: string;
  name: string;
  university: string;
  studentType: string;
  questionText: string;
  original: string;
  subtitle: string;
  comment: string;
  editedText: string;
  edits: RevisionEdit[];
  highlights: string[];
  status: string;
  needsReview: number;
  updatedAt: string;
}

export function RevisionEditor(p: Props) {
  const router = useRouter();
  const [subtitle, setSubtitle] = useState(p.subtitle);
  const [comment, setComment] = useState(p.comment);
  const [edits, setEdits] = useState<RevisionEdit[]>(p.edits);
  const [edited, setEdited] = useState(p.editedText || p.original);
  const [highlights, setHighlights] = useState<string[]>(p.highlights);
  const [needsReview, setNeedsReview] = useState(p.needsReview === 1);
  const [manual, setManual] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(p.updatedAt);
  const [confirmToggle, setConfirmToggle] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const appliedCount = edits.filter((e) => e.applied).length;

  /** 교정 토글 → 항상 원문 기준으로 다시 계산한다. */
  function toggle(id: string) {
    if (manual) return setConfirmToggle(id);
    applyToggle(id);
  }

  function applyToggle(id: string) {
    const next = edits.map((e) => (e.id === id ? { ...e, applied: !e.applied } : e));
    setEdits(next);
    setEdited(applyEdits(p.original, next));
    setManual(false);
    setSaved(null);
    setConfirmToggle(null);
  }

  function addHighlightFromSelection() {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) return setMsg("탈고문에서 밑줄 칠 문장을 먼저 선택하세요.");
    if (!edited.includes(sel)) return setMsg("선택한 문장을 탈고문에서 찾을 수 없습니다.");
    if (highlights.includes(sel)) return setMsg("이미 밑줄이 있는 문장입니다.");
    setHighlights([...highlights, sel]);
    setMsg("");
    setSaved(null);
  }

  async function save(status: "edited" | "final") {
    setBusy(status);
    setMsg("");
    const r = (await fetch("/api/ax/manuscript", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        subtitle,
        comment,
        edited_text: edited,
        revision_json: JSON.stringify(edits),
        highlights_json: JSON.stringify(highlights),
        status,
        needs_review: needsReview ? 1 : 0,
      }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "네트워크 오류" }))) as { status?: string; updated_at?: string; error?: string };
    setBusy("");
    if (r.error) return setMsg(r.error);
    if (r.updated_at) setUpdatedAt(r.updated_at);
    setSaved(status === "final" ? "확정됨" : "저장됨");
    router.refresh();
  }

  /** 밑줄 구간을 표시한 탈고문 미리보기 */
  const previewNodes = useMemo(() => {
    if (highlights.length === 0) return [edited];
    const pattern = highlights
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    if (!pattern) return [edited];
    const parts = edited.split(new RegExp(`(${pattern})`, "g"));
    return parts.map((s, i) =>
      highlights.includes(s) ? (
        <span key={i} className="hl-underline">
          {s}
        </span>
      ) : (
        s
      ),
    );
  }, [edited, highlights]);

  return (
    <div className="page-body">
      {/* 상단 툴바 — 밑줄·저장·확정 */}
      <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <span className="toolbar" style={{ margin: 0, gap: 8 }}>
          <b style={{ fontSize: 15 }}>{p.name}</b>
          <span className="faint">{p.university || "대학 미입력"}</span>
          <span className="faint">·</span>
          <span className="faint">{p.studentType || "-"}</span>
          <span className="faint">· 최종 편집 {formatEditedAt(updatedAt)}</span>
        </span>
        <span className="toolbar" style={{ margin: 0, gap: 8 }}>
          <button className="btn" onClick={addHighlightFromSelection} type="button">
            <Underline size={15} strokeWidth={2} aria-hidden />
            중요 문장 밑줄
          </button>
          <label className="btn" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => {
                setNeedsReview(e.target.checked);
                setSaved(null);
              }}
            />
            검수 필요
          </label>
          <button className="btn" onClick={() => save("edited")} disabled={!!busy} type="button">
            <Save size={15} strokeWidth={2} aria-hidden />
            {busy === "edited" ? "저장 중…" : "저장"}
          </button>
          <button className="btn primary" onClick={() => save("final")} disabled={!!busy} type="button">
            <Check size={15} strokeWidth={2} aria-hidden />
            {busy === "final" ? "확정 중…" : "확정"}
          </button>
          {saved && <span style={{ color: "var(--green)", fontWeight: 600 }}>{saved}</span>}
        </span>
      </div>

      {msg && (
        <div className="alert warn">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          {msg}
        </div>
      )}

      {/* 소제목 · comment */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="flabel">
              소제목<span className="fhint">최대 25자 · {subtitle.length}자</span>
            </span>
            <input
              className="input"
              style={{ width: "100%", height: 40 }}
              value={subtitle}
              maxLength={25}
              onChange={(e) => {
                setSubtitle(e.target.value);
                setSaved(null);
              }}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="flabel">
              항해일지 comment<span className="fhint">편집자 확인 필수 · {comment.length}자</span>
            </span>
            <div className="ta-wrap">
              <textarea
                style={{ minHeight: 64 }}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setSaved(null);
                }}
              />
              <span className="char-count">{comment.length}자 (공백 포함)</span>
            </div>
          </label>
        </div>
      </div>

      {/* 교정 항목 */}
      <div className="section-title">
        탈고 교정 {edits.length}건 중 {appliedCount}건 반영 <span className="faint">(REVISE.md 기준)</span>
      </div>
      {edits.length === 0 ? (
        <div className="empty">
          아직 탈고 결과가 없습니다. 원고 목록에서 ‘AI 원고 탈고 실행’을 눌러주세요.
        </div>
      ) : (
        <div className="diff-list" style={{ marginBottom: 18 }}>
          {edits.map((e) => {
            const meta = KIND_META[e.kind] ?? KIND_META.flow;
            const stale = isStale(p.original, e);
            return (
              <div key={e.id} className={`diff-item${e.applied ? " applied" : ""}`}>
                <div className="d-head">
                  <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  <span className="faint" style={{ fontSize: 12, flex: 1 }}>
                    {e.note || meta.desc}
                  </span>
                  {stale && <span className="badge amber">원문에서 찾을 수 없음</span>}
                  <button className="btn" onClick={() => toggle(e.id)} type="button">
                    {e.applied ? (
                      <>
                        <RotateCcw size={13} strokeWidth={2} aria-hidden />
                        되돌리기
                      </>
                    ) : (
                      <>
                        <Check size={13} strokeWidth={2} aria-hidden />
                        반영하기
                      </>
                    )}
                  </button>
                </div>
                <div className="d-body">
                  <span className={`diff-old ${meta.cls}`}>{e.before || "(추가)"}</span>
                  <span className="diff-arrow">→</span>
                  <span className={meta.cls} style={{ fontWeight: 600 }}>
                    {e.after || "(삭제)"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 원문 / 탈고문 */}
      <div className="section-title toolbar" style={{ justifyContent: "space-between" }}>
        <span>원문 → 탈고문</span>
        <button className="btn" onClick={() => setRawMode(!rawMode)} type="button">
          {rawMode ? (
            <>
              <Eye size={14} strokeWidth={1.75} aria-hidden />
              밑줄 보기
            </>
          ) : (
            <>
              <Pencil size={14} strokeWidth={1.75} aria-hidden />
              직접 편집
            </>
          )}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="pane">
          <div className="faint" style={{ marginBottom: 6 }}>
            원문 <span style={{ fontSize: 11 }}>{p.questionText}</span>
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.8,
              maxHeight: 520,
              overflowY: "auto",
              padding: 12,
              background: "var(--bg-subtle)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {p.original}
          </div>
        </div>
        <div className="pane">
          <div className="faint" style={{ marginBottom: 6 }}>
            탈고문 {highlights.length > 0 && `· 밑줄 ${highlights.length}곳`}
          </div>
          {rawMode ? (
            <textarea
              style={{
                width: "100%",
                height: 520,
                fontSize: 13,
                lineHeight: 1.8,
                padding: 12,
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font)",
                resize: "vertical",
              }}
              value={edited}
              onChange={(e) => {
                setEdited(e.target.value);
                setManual(true);
                setSaved(null);
              }}
            />
          ) : (
            <div
              ref={previewRef}
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 13,
                lineHeight: 1.8,
                maxHeight: 520,
                overflowY: "auto",
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {previewNodes}
            </div>
          )}
        </div>
      </div>

      {/* 밑줄 목록 */}
      {highlights.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="faint" style={{ marginBottom: 8 }}>
            밑줄 {highlights.length}곳 (원고 다운로드에 반영)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {highlights.map((h, i) => (
              <span key={i} className="badge gray" style={{ maxWidth: 420 }}>
                <span className="hl-underline" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {h}
                </span>
                <button
                  onClick={() => {
                    setHighlights(highlights.filter((_, j) => j !== i));
                    setSaved(null);
                  }}
                  aria-label="밑줄 삭제"
                  style={{ marginLeft: 4, border: "none", background: "none", cursor: "pointer", color: "var(--red)" }}
                  type="button"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!confirmToggle}
        title="수동 편집 내용이 사라집니다"
        sub="교정 항목을 바꾸면 탈고문을 원문 기준으로 다시 계산합니다."
        onClose={() => setConfirmToggle(null)}
        footer={
          <>
            <div className="spacer" />
            <button className="btn" onClick={() => setConfirmToggle(null)} type="button">
              취소
            </button>
            <button className="btn primary" onClick={() => confirmToggle && applyToggle(confirmToggle)} type="button">
              다시 계산
            </button>
          </>
        }
      >
        <p className="muted" style={{ margin: 0 }}>
          직접 편집한 문장이 원문 + 반영된 교정 항목 기준으로 되돌아갑니다. 계속하시겠습니까?
        </p>
      </Modal>
    </div>
  );
}

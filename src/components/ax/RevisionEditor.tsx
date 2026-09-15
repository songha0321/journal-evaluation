"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Underline, Save, TriangleAlert, X, Pencil, Eye, MessageSquare, Trash2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { KIND_META, applyEdits, isStale, type RevisionEdit, type RevisionKind } from "@/lib/revision";
import { formatEditedAt } from "@/lib/ax-progress";
import type { EditComment } from "@/lib/queries/compare";

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
  comments: EditComment[];
  userEmail: string;
}

const KINDS = Object.keys(KIND_META) as RevisionKind[];

/** 원문 위에 교정 항목을 순서대로 얹은 세그먼트. 반영된 항목은 before 취소선 + after, 미반영은 before만 점선 표시 */
type Seg = { type: "text"; text: string } | { type: "edit"; edit: RevisionEdit; no: number; stale: boolean };

function segmentsOf(original: string, edits: RevisionEdit[]): Seg[] {
  const placed: { at: number; edit: RevisionEdit }[] = [];
  let cursor = 0;
  // 러너가 준 순서대로 원문에서 위치를 찾는다(같은 문자열이 여러 번이면 앞에서부터)
  for (const e of edits) {
    if (!e.before) continue;
    const at = original.indexOf(e.before, cursor);
    if (at < 0) continue;
    placed.push({ at, edit: e });
    cursor = at + e.before.length;
  }
  placed.sort((a, b) => a.at - b.at);
  const segs: Seg[] = [];
  let pos = 0;
  let no = 0;
  for (const p of placed) {
    if (p.at < pos) continue; // 겹침은 건너뜀
    if (p.at > pos) segs.push({ type: "text", text: original.slice(pos, p.at) });
    segs.push({ type: "edit", edit: p.edit, no: ++no, stale: false });
    pos = p.at + p.edit.before.length;
  }
  if (pos < original.length) segs.push({ type: "text", text: original.slice(pos) });
  return segs;
}

function withHighlights(text: string, highlights: string[]) {
  if (highlights.length === 0) return text;
  const pattern = highlights
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!pattern) return text;
  return text.split(new RegExp(`(${pattern})`, "g")).map((s, i) =>
    highlights.includes(s) ? (
      <span key={i} className="hl-underline">
        {s}
      </span>
    ) : (
      s
    ),
  );
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
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<RevisionKind>>(new Set());
  const [comments, setComments] = useState<EditComment[]>(p.comments);
  const [draft, setDraft] = useState("");

  const appliedCount = edits.filter((e) => e.applied).length;
  const stale = useMemo(() => new Set(edits.filter((e) => isStale(p.original, e)).map((e) => e.id)), [edits, p.original]);
  const segs = useMemo(() => segmentsOf(p.original, edits.filter((e) => !stale.has(e.id))), [p.original, edits, stale]);
  const counts = KINDS.map((k) => ({ k, n: edits.filter((e) => e.kind === k).length }));
  const sel = edits.find((e) => e.id === selected) ?? null;
  const selNo = segs.find((s) => s.type === "edit" && s.edit.id === selected) as Extract<Seg, { type: "edit" }> | undefined;
  const selComments = sel ? comments.filter((c) => c.edit_key === sel.id) : [];
  const commented = new Set(comments.map((c) => c.edit_key));

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
    const s = window.getSelection()?.toString().trim();
    if (!s) return setMsg("탈고문에서 밑줄 칠 문장을 먼저 선택하세요.");
    if (!edited.includes(s)) return setMsg("선택한 문장을 탈고문에서 찾을 수 없습니다.");
    if (highlights.includes(s)) return setMsg("이미 밑줄이 있는 문장입니다.");
    setHighlights([...highlights, s]);
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

  async function addComment() {
    if (!sel || !draft.trim()) return;
    const r = (await fetch("/api/ax/compare/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ article_id: p.id, edit_key: sel.id, body: draft }),
    }).then((x) => x.json())) as { id?: string; error?: string };
    if (r.error) return setMsg(r.error);
    setComments((cs) => [...cs, { id: r.id!, article_id: p.id, edit_key: sel.id, author_email: p.userEmail, author_name: "나", body: draft.trim(), created_at: new Date().toISOString() }]);
    setDraft("");
    router.refresh();
  }
  async function removeComment(id: string) {
    setComments((cs) => cs.filter((c) => c.id !== id));
    await fetch(`/api/ax/compare/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return (
    <div className="page-body">
      {/* 상단 툴바 */}
      <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <span className="toolbar" style={{ margin: 0, gap: 12 }}>
          <span className="faint">{p.questionText}</span>
          <span className="faint">최종 편집 {formatEditedAt(updatedAt)}</span>
        </span>
        <span className="toolbar" style={{ margin: 0, gap: 8 }}>
          <button className="btn" onClick={addHighlightFromSelection} type="button">
            <Icon as={Underline} />
            중요 문장 밑줄
          </button>
          <label className="btn" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={needsReview} onChange={(e) => { setNeedsReview(e.target.checked); setSaved(null); }} />
            검수 필요
          </label>
          <button className="btn" onClick={() => save("edited")} disabled={!!busy} type="button">
            <Icon as={Save} />
            {busy === "edited" ? "저장 중…" : "저장"}
          </button>
          <button className="btn primary" onClick={() => save("final")} disabled={!!busy} type="button">
            <Icon as={Check} />
            {busy === "final" ? "확정 중…" : "확정"}
          </button>
          {saved && <span style={{ color: "var(--green)", fontWeight: 600 }}>{saved}</span>}
        </span>
      </div>

      {msg && (
        <div className="alert warn">
          <Icon as={TriangleAlert} />
          {msg}
        </div>
      )}

      {/* 소제목 · comment */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="rev-head-row">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="flabel">
              소제목<span className="fhint">최대 25자, {subtitle.length}자</span>
            </span>
            <input className="input" style={{ width: "100%", height: 40 }} value={subtitle} maxLength={25} onChange={(e) => { setSubtitle(e.target.value); setSaved(null); }} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="flabel">
              항해일지 comment<span className="fhint">편집자 확인 필수, {comment.length}자</span>
            </span>
            <div className="ta-wrap">
              <textarea style={{ minHeight: 64 }} value={comment} onChange={(e) => { setComment(e.target.value); setSaved(null); }} />
              <span className="char-count">{comment.length}자 (공백 포함)</span>
            </div>
          </label>
        </div>
      </div>

      {/* 범례·필터·모드 */}
      <section className="cmp-legend">
        <span className="faint">교정 {edits.length}건 중 {appliedCount}건 반영</span>
        {counts.map(({ k, n }) => (
          <button
            key={k}
            type="button"
            className={`cmp-leg ${KIND_META[k].cls} ${hidden.has(k) ? "off" : ""}`}
            onClick={() => setHidden((h) => { const s = new Set(h); if (s.has(k)) s.delete(k); else s.add(k); return s; })}
            title={KIND_META[k].desc}
          >
            <i /> {KIND_META[k].label} {n}
          </button>
        ))}
        {stale.size > 0 && <span className="badge amber">원문에서 못 찾음 {stale.size}</span>}
        <span className="cmp-leg-op">
          <s>원문</s> <b>교정</b> 표시, 미반영 항목은 점선. 항목을 누르면 오른쪽에서 반영과 댓글
        </span>
        <button className="btn" style={{ marginLeft: 8 }} onClick={() => setRawMode(!rawMode)} type="button">
          {rawMode ? (
            <>
              <Icon as={Eye} />
              표기 보기
            </>
          ) : (
            <>
              <Icon as={Pencil} />
              직접 편집
            </>
          )}
        </button>
      </section>

      <div className="cmp-grid">
        <article className="cmp-text">
          {edits.length === 0 && !rawMode && (
            <div className="empty">아직 탈고 결과가 없습니다. 원고 목록에서 ‘AI 원고 탈고 실행’을 눌러주세요.</div>
          )}
          {rawMode ? (
            <textarea
              className="rev-raw"
              value={edited}
              onChange={(e) => { setEdited(e.target.value); setManual(true); setSaved(null); }}
            />
          ) : (
            <div style={{ whiteSpace: "pre-wrap" }}>
              {segs.map((s, i) => {
                if (s.type === "text") return <span key={i}>{withHighlights(s.text, highlights)}</span>;
                const e = s.edit;
                const meta = KIND_META[e.kind] ?? KIND_META.flow;
                if (hidden.has(e.kind)) return <span key={i}>{e.applied ? withHighlights(e.after, highlights) : e.before}</span>;
                return (
                  <mark
                    key={i}
                    className={`chg ${e.applied ? "replace" : "pending"} ${meta.cls} ${selected === e.id ? "sel" : ""}`}
                    title={e.note || meta.desc}
                    onClick={() => setSelected(e.id)}
                  >
                    <sup className="chg-no">{s.no}</sup>
                    {e.applied ? (
                      <>
                        <s className="chg-before">{e.before}</s>
                        <span className="chg-after">{withHighlights(e.after || "", highlights)}{!e.after && <span className="faint">(삭제)</span>}</span>
                      </>
                    ) : (
                      <span className="chg-keep">{e.before}</span>
                    )}
                    {commented.has(e.id) && <Icon as={MessageSquare} size="sm" className="chg-cm" />}
                  </mark>
                );
              })}
            </div>
          )}

          {highlights.length > 0 && (
            <div className="rev-hl">
              <div className="faint" style={{ marginBottom: 6 }}>밑줄 {highlights.length}곳 (원고 다운로드에 반영)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {highlights.map((h, i) => (
                  <span key={i} className="badge gray" style={{ maxWidth: 420 }}>
                    <span className="hl-underline" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{h}</span>
                    <button onClick={() => { setHighlights(highlights.filter((_, j) => j !== i)); setSaved(null); }} aria-label="밑줄 삭제" className="kebab-btn" style={{ width: 20, height: 20 }} type="button">
                      <Icon as={X} size="sm" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>

        <aside className="cmp-side">
          {!sel ? (
            <div className="empty" style={{ padding: "32px 12px" }}>본문에서 교정 항목을 누르면 여기에 원문, 교정, 댓글이 보입니다.</div>
          ) : (
            <>
              <div className="cmp-side-head">
                <b>#{selNo?.no ?? "-"} <span className={`badge ${(KIND_META[sel.kind] ?? KIND_META.flow).cls}`}>{(KIND_META[sel.kind] ?? KIND_META.flow).label}</span></b>
                <button className="btn" onClick={() => toggle(sel.id)} type="button">
                  {sel.applied ? (
                    <>
                      <Icon as={RotateCcw} />
                      되돌리기
                    </>
                  ) : (
                    <>
                      <Icon as={Check} />
                      반영하기
                    </>
                  )}
                </button>
              </div>
              <div className="cmp-reason muted">{sel.note || (KIND_META[sel.kind] ?? KIND_META.flow).desc}{stale.has(sel.id) ? " (원문에서 찾을 수 없음)" : ""}</div>
              <div className="cmp-pair">
                <div className="cmp-pair-label">원문</div>
                <div className="cmp-pair-text before">{sel.before || "(추가)"}</div>
              </div>
              <div className="cmp-pair">
                <div className="cmp-pair-label">교정 {sel.applied ? "(반영됨)" : "(미반영)"}</div>
                <div className="cmp-pair-text after">{sel.after || "(삭제)"}</div>
              </div>

              <div className="section-title" style={{ marginTop: 18 }}>댓글 {selComments.length}</div>
              <ul className="cmp-comments">
                {selComments.map((c) => (
                  <li key={c.id}>
                    <div className="cmp-cm-head">
                      <b>{c.author_name}</b>
                      <span className="faint">{formatEditedAt(c.created_at)}</span>
                      {c.author_email === p.userEmail && (
                        <button type="button" className="kebab-btn" style={{ width: 24, height: 24, marginLeft: "auto" }} onClick={() => removeComment(c.id)} aria-label="댓글 삭제">
                          <Icon as={Trash2} size="sm" />
                        </button>
                      )}
                    </div>
                    <div className="cmp-cm-body">{c.body}</div>
                  </li>
                ))}
                {selComments.length === 0 && <li className="faint" style={{ fontSize: 13 }}>아직 댓글이 없습니다.</li>}
              </ul>
              <div className="ta-wrap" style={{ marginTop: 8 }}>
                <textarea
                  value={draft}
                  placeholder="이 교정에 대한 의견을 남기세요. Cmd+Enter로 등록"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && addComment()}
                  style={{ minHeight: 72, paddingBottom: 12 }}
                />
              </div>
              <div className="toolbar" style={{ margin: "8px 0 0", justifyContent: "flex-end" }}>
                <button type="button" className="btn primary" onClick={addComment} disabled={!draft.trim()}>
                  댓글 달기
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

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

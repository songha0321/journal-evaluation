"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, Trash2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Dropdown } from "@/components/ui/Dropdown";
import { diffWords, mergeSources, type Change } from "@/lib/compare";
import { KIND_META, type RevisionKind } from "@/lib/revision";
import type { SourceCandidate, EditComment } from "@/lib/queries/compare";
import { formatEditedAt } from "@/lib/ax-progress";

const KINDS = Object.keys(KIND_META) as RevisionKind[];
const OP_LABEL = { insert: "추가", delete: "삭제", replace: "치환" } as const;

function Text({ t }: { t: string }) {
  // ¶ → 줄바꿈
  const parts = t.split("¶");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {p.trim()}
          {i < parts.length - 1 ? "" : " "}
        </span>
      ))}
    </>
  );
}

export function CompareView({
  articleId,
  finalText,
  candidates,
  chosenIds,
  comments: initialComments,
  labels: initialLabels,
  userEmail,
}: {
  articleId: string;
  finalText: string;
  candidates: SourceCandidate[];
  chosenIds: string[];
  comments: EditComment[];
  labels: Record<string, RevisionKind>;
  userEmail: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(chosenIds.length ? chosenIds : candidates[0] ? [candidates[0].qna_id] : []);
  const [labels, setLabels] = useState(initialLabels);
  const [comments, setComments] = useState(initialComments);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<RevisionKind>>(new Set());
  const [showSource, setShowSource] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const sourceText = useMemo(
    () => mergeSources(finalText, candidates.filter((c) => picked.includes(c.qna_id)).map((c) => ({ id: c.qna_id, text: c.answer_text }))),
    [candidates, picked, finalText],
  );
  const source = sourceText ? { answer_text: sourceText } : null;
  const diff = useMemo(() => (source ? diffWords(source.answer_text, finalText) : { segments: [], changes: [] as Change[] }), [source, finalText]);
  const sameAsChosen = picked.length === chosenIds.length && picked.every((id) => chosenIds.includes(id));
  const kindOf = (c: Change): RevisionKind => labels[c.key] ?? c.kind;
  const counts = KINDS.map((k) => ({ k, n: diff.changes.filter((c) => kindOf(c) === k).length }));
  const sel = diff.changes.find((c) => c.key === selected) ?? null;
  const selComments = sel ? comments.filter((c) => c.edit_key === sel.key) : [];
  const commentedKeys = new Set(comments.map((c) => c.edit_key));

  async function confirmSource() {
    setBusy(true);
    await fetch("/api/ax/compare/source", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ article_id: articleId, qna_ids: picked }) });
    setBusy(false);
    setMsg("원문을 확정했습니다.");
    router.refresh();
  }
  async function setKind(c: Change, kind: RevisionKind) {
    setLabels((l) => ({ ...l, [c.key]: kind }));
    await fetch("/api/ax/compare/label", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ article_id: articleId, edit_key: c.key, kind }) });
  }
  async function addComment() {
    if (!sel || !draft.trim()) return;
    setBusy(true);
    const r = (await fetch("/api/ax/compare/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ article_id: articleId, edit_key: sel.key, body: draft }) }).then((x) => x.json())) as { id?: string; error?: string };
    setBusy(false);
    if (r.error) return setMsg(r.error);
    setComments((cs) => [...cs, { id: r.id!, article_id: articleId, edit_key: sel.key, author_email: userEmail, author_name: "나", body: draft.trim(), created_at: new Date().toISOString() }]);
    setDraft("");
    router.refresh();
  }
  async function removeComment(id: string) {
    setComments((cs) => cs.filter((c) => c.id !== id));
    await fetch(`/api/ax/compare/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return (
    <div className="page-body">
      {/* 원문 후보 */}
      <section className="cmp-source">
        <div className="cmp-source-head">
          <b>원문 후보</b>
          <span className="faint">같은 작성자의 수기 답변 중 유사도 상위 {candidates.length}건. 여러 답변을 합쳐 쓴 원고면 함께 체크하면 탈고문 순서대로 이어 붙여 비교합니다</span>
          {msg && <span className="muted">{msg}</span>}
        </div>
        <div className="cmp-cands">
          {candidates.map((c, i) => {
            const on = picked.includes(c.qna_id);
            return (
              <label key={c.qna_id} className={`cmp-cand ${on ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    setPicked((p) => (p.includes(c.qna_id) ? p.filter((x) => x !== c.qna_id) : [...p, c.qna_id]));
                    setSelected(null);
                  }}
                />
                <span className="cmp-cand-body">
                  <span className="cmp-cand-top">
                    <span className="cmp-score">{c.score ? c.score.toFixed(2) : "확정"}</span>
                    <span className="strong">{i + 1}순위</span>
                    {chosenIds.includes(c.qna_id) && <span className="badge green">확정됨</span>}
                    <span className="muted">{c.author_name} {c.cohort}기</span>
                  </span>
                  <span className="cmp-cand-q clip">{c.question_key ? `[${c.question_key}] ` : ""}{c.question_text}</span>
                  <span className="cmp-cand-a clip">{c.answer_text.replace(/\s+/g, " ").slice(0, 140)}</span>
                </span>
              </label>
            );
          })}
          {candidates.length === 0 && <div className="empty">이 작성자의 수기 답변이 D1에 없습니다.</div>}
        </div>
        <div className="toolbar" style={{ margin: "12px 0 0" }}>
          <button type="button" className="btn primary" onClick={confirmSource} disabled={busy || picked.length === 0 || sameAsChosen}>
            <Icon as={Check} />
            선택한 {picked.length}건을 원문으로 확정
          </button>
          <button type="button" className="btn" onClick={() => setShowSource((v) => !v)} disabled={!source}>
            {showSource ? "원문 전체 닫기" : "원문 전체 보기"}
          </button>
        </div>
        {showSource && source && <pre className="cmp-raw">{source.answer_text}</pre>}
      </section>

      {/* 범례·필터 */}
      <section className="cmp-legend">
        <span className="faint">변경 {diff.changes.length}건</span>
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
        <span className="cmp-leg-op"><s>삭제</s> <u>추가</u> <em>치환</em> 표시. 항목을 누르면 오른쪽에 상세와 댓글</span>
      </section>

      <div className="cmp-grid">
        {/* 탈고문 + 표기 */}
        <article className="cmp-text">
          {diff.segments.map((s, i) => {
            if (s.type === "equal") return <Text key={i} t={s.text} />;
            const c = s.change;
            const kind = kindOf(c);
            if (hidden.has(kind)) return <Text key={i} t={c.after || ""} />;
            return (
              <mark
                key={i}
                className={`chg ${c.op} ${KIND_META[kind].cls} ${selected === c.key ? "sel" : ""}`}
                title={c.op === "insert" ? `추가 (${KIND_META[kind].label})` : `원문: ${c.before.replace(/¶/g, " ")}`}
                onClick={() => setSelected(c.key)}
              >
                <sup className="chg-no">{c.no}</sup>
                {c.op !== "insert" && <s className="chg-before">{c.before.replace(/¶/g, " ")}</s>}
                {c.op !== "delete" && <span className="chg-after"><Text t={c.after} /></span>}
                {commentedKeys.has(c.key) && <Icon as={MessageSquare} size="sm" className="chg-cm" />}
              </mark>
            );
          })}
          {!source && <div className="empty">비교할 원문을 고르세요.</div>}
        </article>

        {/* 상세·댓글 */}
        <aside className="cmp-side">
          {!sel ? (
            <div className="empty" style={{ padding: "32px 12px" }}>본문에서 변경 항목을 누르면 여기에 원문과 댓글이 보입니다.</div>
          ) : (
            <>
              <div className="cmp-side-head">
                <b>#{sel.no} {OP_LABEL[sel.op]}</b>
                <Dropdown
                  value={kindOf(sel)}
                  options={KINDS.map((k) => ({ value: k, label: KIND_META[k].label }))}
                  onChange={(v) => setKind(sel, v as RevisionKind)}
                  ariaLabel="규칙"
                  width={150}
                />
              </div>
              <div className="cmp-reason muted">{labels[sel.key] ? "편집자가 규칙을 지정함" : `자동 분류: ${sel.reason}`}</div>
              {sel.op !== "insert" && (
                <div className="cmp-pair">
                  <div className="cmp-pair-label">원문</div>
                  <div className="cmp-pair-text before">{sel.before.replace(/¶/g, "\n")}</div>
                </div>
              )}
              {sel.op !== "delete" && (
                <div className="cmp-pair">
                  <div className="cmp-pair-label">탈고문</div>
                  <div className="cmp-pair-text after">{sel.after.replace(/¶/g, "\n")}</div>
                </div>
              )}

              <div className="section-title" style={{ marginTop: 18 }}>댓글 {selComments.length}</div>
              <ul className="cmp-comments">
                {selComments.map((c) => (
                  <li key={c.id}>
                    <div className="cmp-cm-head">
                      <b>{c.author_name}</b>
                      <span className="faint">{formatEditedAt(c.created_at)}</span>
                      {c.author_email === userEmail && (
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
                <button type="button" className="btn primary" onClick={addComment} disabled={busy || !draft.trim()}>
                  댓글 달기
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

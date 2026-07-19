"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  id: string;
  tocId: string;
  authorId: string;
  name: string;
  university: string;
  studentType: string;
  score: number | null;
  original: string;
  subtitle: string;
  comment: string;
  editedText: string;
  highlights: string[];
  status: string;
}

export function Editor(p: Props) {
  const [subtitle, setSubtitle] = useState(p.subtitle);
  const [comment, setComment] = useState(p.comment);
  const [edited, setEdited] = useState(p.editedText || p.original);
  const [highlights, setHighlights] = useState<string[]>(p.highlights);
  const [hlInput, setHlInput] = useState("");
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState(false);
  const [aiNote, setAiNote] = useState("");

  async function gen(kind: "revise" | "comment" | "subtitle") {
    setBusy(kind);
    setSaved(false);
    const r = (await fetch("/api/ax/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, author_id: p.authorId, text: kind === "revise" ? undefined : edited }),
    }).then((x) => x.json())) as { error?: string; ai?: boolean; result?: string };
    setBusy("");
    if (r.error) return setAiNote(r.error);
    const result = r.result ?? "";
    setAiNote(r.ai ? "AI(OpenAI) 생성" : "폴백(규칙 기반) — OPENAI_API_KEY 미설정");
    if (kind === "revise") setEdited(result);
    if (kind === "comment") setComment(result);
    if (kind === "subtitle") setSubtitle(result.slice(0, 25));
  }

  async function save(status?: string) {
    setBusy("save");
    await fetch("/api/ax/manuscript", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        subtitle,
        comment,
        edited_text: edited,
        highlights_json: JSON.stringify(highlights),
        status: status || "edited",
      }),
    });
    setBusy("");
    setSaved(true);
  }

  function addHighlight() {
    const t = hlInput.trim();
    if (t && !highlights.includes(t)) setHighlights([...highlights, t]);
    setHlInput("");
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            <Link className="row-link" href={`/ax/toc/${p.tocId}`}>
              ← 목차로
            </Link>
          </p>
          <h1>
            {p.name} <span className="faint" style={{ fontSize: 14 }}>{p.university || ""}</span>
          </h1>
          <p className="muted">
            {p.studentType || "-"} · 평가점수 {p.score ?? "-"} {aiNote && <span style={{ color: "var(--accent)" }}>· {aiNote}</span>}
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => save("edited")} disabled={!!busy}>
            {busy === "save" ? "저장 중…" : "저장"}
          </button>
          <button
            className="btn"
            onClick={() => save("final")}
            disabled={!!busy}
            style={{ background: "var(--green)", color: "#fff" }}
          >
            확정
          </button>
          {saved && <span style={{ color: "var(--green)" }}>저장됨 ✓</span>}
        </div>
      </div>

      {/* 소제목 + comment */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <label style={{ flex: 1 }}>
            <div className="faint">소제목 (≤25자, {subtitle.length}자)</div>
            <input
              className="input"
              value={subtitle}
              maxLength={25}
              onChange={(e) => setSubtitle(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <button className="btn" onClick={() => gen("subtitle")} disabled={!!busy}>
            {busy === "subtitle" ? "…" : "AI 소제목"}
          </button>
        </div>
        <div className="toolbar" style={{ alignItems: "flex-start" }}>
          <label style={{ flex: 1 }}>
            <div className="faint">항해일지 comment (편집자 확인 필수)</div>
            <textarea
              className="input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
            />
          </label>
          <button className="btn" onClick={() => gen("comment")} disabled={!!busy} style={{ marginTop: 18 }}>
            {busy === "comment" ? "…" : "AI comment"}
          </button>
        </div>
      </div>

      {/* 원문 / 탈고문 */}
      <div className="section-title toolbar" style={{ justifyContent: "space-between" }}>
        <span>원문 → 탈고 (REVISE.md 기준)</span>
        <button className="btn" onClick={() => gen("revise")} disabled={!!busy} style={{ background: "var(--accent)", color: "#fff" }}>
          {busy === "revise" ? "탈고 중…" : "AI 자동 탈고"}
        </button>
      </div>
      <div className="pane-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div className="pane">
          <div className="faint" style={{ marginBottom: 6 }}>원문</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, maxHeight: 460, overflowY: "auto" }}>
            {p.original || "(원문 없음)"}
          </div>
        </div>
        <div className="pane">
          <div className="faint" style={{ marginBottom: 6 }}>탈고문 (편집 가능)</div>
          <textarea
            className="input"
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            style={{ width: "100%", height: 460, resize: "vertical", fontSize: 13, lineHeight: 1.7 }}
          />
        </div>
      </div>

      {/* 밑줄 */}
      <div className="card">
        <div className="faint" style={{ marginBottom: 6 }}>중요 문장 밑줄 (export 시 적용)</div>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <input
            className="input"
            placeholder="밑줄 칠 문구를 붙여넣고 추가"
            value={hlInput}
            onChange={(e) => setHlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHighlight()}
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={addHighlight}>
            + 밑줄
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {highlights.map((h, i) => (
            <span key={i} className="badge" style={{ textDecoration: "underline" }}>
              {h}
              <button
                onClick={() => setHighlights(highlights.filter((_, j) => j !== i))}
                style={{ marginLeft: 6, border: "none", background: "none", cursor: "pointer", color: "var(--red)" }}
              >
                ×
              </button>
            </span>
          ))}
          {highlights.length === 0 && <span className="faint">아직 없음</span>}
        </div>
      </div>
    </div>
  );
}

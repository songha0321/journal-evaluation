"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cand {
  author_id: string;
  name: string;
  student_type: string | null;
  final_university: string | null;
  total_score: number | null;
  is_selected: number | null;
  evaluation_summary: string | null;
  answered: number;
}
interface Q {
  id: string;
  question_key: string | null;
  question_text: string;
  category: string | null;
}

const COHORTS = [9, 8, 7, 6, 5];
const TYPES = ["", "성적우수", "성적향상", "우선선발", "포레스트"];

export default function SelectPage() {
  const router = useRouter();
  const [issue, setIssue] = useState("1호차");
  const [partNo, setPartNo] = useState("2");
  const [chapterNo, setChapterNo] = useState("1");
  const [title, setTitle] = useState("상반기 공부법");
  const [tocContent, setTocContent] = useState("과목별 상반기 공부법과 6평 전후 피드백 방법");
  const [hanmadi, setHanmadi] = useState("");
  const [cohort, setCohort] = useState(9);
  const [type, setType] = useState("");
  const [count, setCount] = useState(10);

  const [questions, setQuestions] = useState<Q[]>([]);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [cands, setCands] = useState<Cand[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadQuestions() {
    setLoading(true);
    const r = (await fetch(`/api/ax/questions?cohort=${cohort}`).then((x) => x.json())) as { questions?: Q[] };
    setQuestions(r.questions ?? []);
    const init: Record<string, boolean> = {};
    (r.questions ?? []).forEach((q: Q) => (init[q.id] = true));
    setApproved(init);
    setLoading(false);
  }

  async function loadCandidates() {
    setLoading(true);
    const r = (await fetch(
      `/api/ax/candidates?cohort=${cohort}${type ? `&type=${encodeURIComponent(type)}` : ""}`,
    ).then((x) => x.json())) as { candidates?: Cand[] };
    const list: Cand[] = r.candidates ?? [];
    setCands(list);
    // 기본 선별: is_selected=1(또는 상위 count) 자동 체크
    const init: Record<string, boolean> = {};
    list.slice(0, count).forEach((c) => (init[c.author_id] = c.is_selected === 1 || (c.total_score ?? 0) >= 80));
    setPicked(init);
    setLoading(false);
  }

  const pickedIds = Object.keys(picked).filter((k) => picked[k]);

  async function confirm() {
    if (!title.trim()) return setMsg("목차명을 입력하세요.");
    if (pickedIds.length === 0) return setMsg("최소 1개 수기를 선택하세요.");
    setLoading(true);
    setMsg("");
    const r = (await fetch("/api/ax/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        issue,
        part_no: partNo ? Number(partNo) : null,
        chapter_no: chapterNo ? Number(chapterNo) : null,
        title,
        toc_content: tocContent,
        hanmadi,
        cohort,
        select_count: count,
        author_ids: pickedIds,
      }),
    }).then((x) => x.json())) as { toc_id?: string; error?: string };
    setLoading(false);
    if (r.toc_id) {
      router.push(`/ax/toc/${r.toc_id}`);
    } else {
      setMsg(r.error || "저장 실패");
    }
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>수기 선별</h1>
          <p className="muted">목차 구성 → 질문 승인(question DB) → 후보 검토 → 최종 선별</p>
        </div>
      </div>

      {/* 1. 목차 */}
      <div className="section-title">1. 목차 구성</div>
      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        <label>
          <div className="faint">호차</div>
          <input className="input" value={issue} onChange={(e) => setIssue(e.target.value)} />
        </label>
        <label>
          <div className="faint">Part</div>
          <input className="input" value={partNo} onChange={(e) => setPartNo(e.target.value)} />
        </label>
        <label>
          <div className="faint">Chapter</div>
          <input className="input" value={chapterNo} onChange={(e) => setChapterNo(e.target.value)} />
        </label>
        <label>
          <div className="faint">목차명</div>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={{ gridColumn: "1 / 3" }}>
          <div className="faint">목차내용 (선별 기준)</div>
          <input className="input" value={tocContent} onChange={(e) => setTocContent(e.target.value)} />
        </label>
        <label style={{ gridColumn: "3 / 5" }}>
          <div className="faint">한마디 (export 노출)</div>
          <input className="input" value={hanmadi} onChange={(e) => setHanmadi(e.target.value)} />
        </label>
      </div>

      {/* 2. 대상 */}
      <div className="section-title">2. 대상 · 선별 개수</div>
      <div className="card toolbar" style={{ gap: 12, marginBottom: 18, alignItems: "flex-end" }}>
        <label>
          <div className="faint">기수</div>
          <select className="select" value={cohort} onChange={(e) => setCohort(Number(e.target.value))}>
            {COHORTS.map((c) => (
              <option key={c} value={c}>
                {c}기
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="faint">전형</div>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t || "전체"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="faint">선별 개수</div>
          <input
            className="input"
            type="number"
            style={{ width: 90 }}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <button className="btn" onClick={loadQuestions} disabled={loading}>
          질문 제안 불러오기
        </button>
      </div>

      {/* 3. 질문 승인 */}
      {questions.length > 0 && (
        <>
          <div className="section-title">3. 질문 승인 (question DB) — {questions.filter((q) => approved[q.id]).length}개 승인</div>
          <div className="card" style={{ marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
            {questions.map((q) => (
              <label key={q.id} style={{ display: "flex", gap: 8, padding: "4px 0", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={!!approved[q.id]}
                  onChange={(e) => setApproved({ ...approved, [q.id]: e.target.checked })}
                />
                <span>
                  <span className="badge" style={{ marginRight: 6 }}>
                    {q.question_key || "-"}
                  </span>
                  {q.question_text}
                </span>
              </label>
            ))}
          </div>
          <button className="btn" onClick={loadCandidates} disabled={loading} style={{ marginBottom: 18 }}>
            승인 질문 기준 후보 수기 분석 →
          </button>
        </>
      )}

      {/* 4. 후보 */}
      {cands.length > 0 && (
        <>
          <div className="section-title">
            4. 후보 수기 — {pickedIds.length} / {cands.length} 선택
          </div>
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>이름</th>
                  <th>전형</th>
                  <th>최종대학</th>
                  <th>점수</th>
                  <th>AI 선별</th>
                  <th>평가 요약</th>
                </tr>
              </thead>
              <tbody>
                {cands.map((c) => (
                  <tr key={c.author_id} style={{ background: picked[c.author_id] ? "var(--accent-bg)" : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!picked[c.author_id]}
                        onChange={(e) => setPicked({ ...picked, [c.author_id]: e.target.checked })}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.student_type || "-"}</td>
                    <td className="muted">{c.final_university || "-"}</td>
                    <td>
                      <span className="score-chip">{c.total_score ?? "-"}</span>
                    </td>
                    <td>{c.is_selected === 1 ? "✓" : ""}</td>
                    <td className="muted" style={{ maxWidth: 320, fontSize: 12 }}>
                      {c.evaluation_summary || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <button
              className="btn"
              onClick={confirm}
              disabled={loading}
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {loading ? "저장 중…" : `${pickedIds.length}개 선별 확정 → 원고 작업`}
            </button>
            {msg && <span style={{ color: "var(--red)" }}>{msg}</span>}
          </div>
        </>
      )}
      {msg && cands.length === 0 && <p style={{ color: "var(--red)" }}>{msg}</p>}
    </div>
  );
}

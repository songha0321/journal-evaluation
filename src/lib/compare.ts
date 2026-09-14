/**
 * 원문(qna 답변) ↔ 탈고문(게재 원고) 비교.
 * - similarity: 원문 후보 찾기용 점수 (문자 3-gram 자카드 + 어절 LCS 비율)
 * - diffWords: 어절 단위 LCS diff → 변경 항목(추가/삭제/치환) + 규칙 분류(REVISE.md 5종)
 * 서버·클라이언트 공용. 외부 의존성 없음.
 */
import type { RevisionKind } from "./revision";

export type ChangeOp = "insert" | "delete" | "replace";

export interface Change {
  key: string;
  no: number;
  op: ChangeOp;
  before: string;
  after: string;
  kind: RevisionKind;
  reason: string;
}

export type Segment = { type: "equal"; text: string } | { type: "change"; change: Change };

/* ── 유사도 ───────────────────────────────────────────── */

function norm(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function trigrams(s: string): Set<string> {
  const t = norm(s).replace(/\s/g, "");
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function tokenize(s: string): string[] {
  // 문단 경계는 ¶ 토큰으로 남겨 렌더 때 줄바꿈으로 되살린다
  return norm(s.replace(/\r/g, "").replace(/\n+/g, " ¶ ")).split(" ").filter(Boolean);
}

function lcsLength(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;
  let prev = new Uint16Array(m + 1);
  let cur = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}

/** 0~1. 탈고문(edited)이 원문(original)에서 왔을 가능성 */
export function similarity(original: string, edited: string): number {
  const ta = trigrams(original);
  const tb = trigrams(edited);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const g of tb) if (ta.has(g)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const wa = tokenize(original).filter((t) => t !== "¶");
  const wb = tokenize(edited).filter((t) => t !== "¶");
  const lcs = lcsLength(wa, wb) / Math.max(1, Math.min(wa.length, wb.length));
  return Math.round((0.5 * jaccard + 0.5 * lcs) * 1000) / 1000;
}

/* ── diff ─────────────────────────────────────────────── */

type Op = { t: "eq" | "del" | "ins"; a?: string; b?: string };

function lcsDiff(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: "eq", a: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: "del", a: a[i++] });
    } else {
      ops.push({ t: "ins", b: b[j++] });
    }
  }
  while (i < n) ops.push({ t: "del", a: a[i++] });
  while (j < m) ops.push({ t: "ins", b: b[j++] });
  return ops;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ── 규칙 분류 ───────────────────────────────────────── */

const SENSITIVE = [
  "빌보드", "수석", "만점", "1등", "일등", "백분위", "전교", "전국", "메가스터디", "메가", "대성", "이투스", "종로", "유웨이", "오르비",
  "쉬웠", "쉽게", "어렵지 않", "별로 안", "자랑", "천재",
];
const TERMS = [
  "평가원", "모의고사", "모의평가", "6평", "9평", "수능", "서바이벌", "브릿지", "기출", "EBS", "연계", "파이널", "더프", "사설",
  "시대인재", "시대N", "재종", "반수", "N수", "정시", "수시", "내신",
];

function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[m];
}

const SENT_END = /[.!?。…]["”’)]?$/;

function classify(op: ChangeOp, before: string, after: string): { kind: RevisionKind; reason: string } {
  const src = before.replace(/¶/g, " ").trim();
  const dst = after.replace(/¶/g, " ").trim();
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const hasSensitive = SENSITIVE.find((k) => src.includes(k));
  if (op !== "insert" && hasSensitive) return { kind: "sensitive", reason: `민감 표현 "${hasSensitive}" 삭제 또는 완화` };
  if (op === "replace") {
    const compact = (s: string) => s.replace(/[\s.,!?'"“”‘’·]/g, "");
    const a = compact(src);
    const b = compact(dst);
    if (a === b) return { kind: "typo", reason: "띄어쓰기 또는 문장부호 교정" };
    const d = levenshtein(a, b) / Math.max(1, Math.max(a.length, b.length));
    if (d <= 0.34 && Math.max(words(src), words(dst)) <= 3) return { kind: "typo", reason: "오탈자 또는 맞춤법 교정" };
    const term = TERMS.find((k) => dst.includes(k) || src.includes(k));
    if (term && Math.max(words(src), words(dst)) <= 6) return { kind: "term", reason: `용어 통일 (${term})` };
    if (words(src) >= 8 || words(dst) >= 8 || SENT_END.test(src) || SENT_END.test(dst)) return { kind: "structure", reason: "문장 단위 재구성" };
    return { kind: "flow", reason: "표현 다듬기" };
  }
  if (op === "delete") {
    if (words(src) >= 8 || SENT_END.test(src)) return { kind: "structure", reason: "문장 삭제" };
    return { kind: "flow", reason: "불필요한 수식어 또는 반복 삭제" };
  }
  if (words(dst) >= 8 || SENT_END.test(dst)) return { kind: "structure", reason: "문장 추가" };
  const term = TERMS.find((k) => dst.includes(k));
  if (term) return { kind: "term", reason: `용어 보강 (${term})` };
  return { kind: "flow", reason: "연결어 또는 보조 표현 추가" };
}

/** 어절 diff → 렌더용 세그먼트 + 변경 목록 */
export function diffWords(original: string, edited: string): { segments: Segment[]; changes: Change[] } {
  const a = tokenize(original);
  const b = tokenize(edited);
  const ops = lcsDiff(a, b);

  // 인접한 del/ins 묶음을 하나의 변경으로 합친다(¶만 다른 것은 동일 취급)
  const segments: Segment[] = [];
  const changes: Change[] = [];
  const seen = new Map<string, number>();
  let eqBuf: string[] = [];
  let delBuf: string[] = [];
  let insBuf: string[] = [];
  const flushEq = () => {
    if (eqBuf.length) segments.push({ type: "equal", text: eqBuf.join(" ") });
    eqBuf = [];
  };
  const flushChange = () => {
    if (!delBuf.length && !insBuf.length) return;
    const before = delBuf.join(" ");
    const after = insBuf.join(" ");
    delBuf = [];
    insBuf = [];
    if (before.replace(/¶/g, "").trim() === after.replace(/¶/g, "").trim()) {
      eqBuf.push(after || before);
      return;
    }
    const op: ChangeOp = before && after ? "replace" : before ? "delete" : "insert";
    const { kind, reason } = classify(op, before, after);
    const base = hash(`${before}|${after}`);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const change: Change = { key: `${base}-${n}`, no: changes.length + 1, op, before, after, kind, reason };
    changes.push(change);
    flushEq();
    segments.push({ type: "change", change });
  };
  for (const o of ops) {
    if (o.t === "eq") {
      flushChange();
      eqBuf.push(o.a!);
    } else if (o.t === "del") {
      if (insBuf.length) flushChange();
      delBuf.push(o.a!);
    } else {
      insBuf.push(o.b!);
    }
  }
  flushChange();
  flushEq();
  return { segments, changes };
}


/* ── 여러 원문 합치기 ─────────────────────────────────── */

function sentences(s: string): string[] {
  return norm(s)
    .split(/(?<=[.!?。…])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 6);
}

/**
 * 고른 답변들을 탈고문에서 등장하는 순서대로 정렬해 하나의 원문으로 잇는다.
 * 각 답변의 위치 = 그 답변 문장들과 가장 잘 겹치는 탈고문 문장의 순번.
 */
export function mergeSources(finalText: string, answers: { id: string; text: string }[]): string {
  if (answers.length <= 1) return answers[0]?.text ?? "";
  const fin = sentences(finalText).map((x) => trigrams(x));
  const pos = answers.map((a) => {
    let best = 0;
    let at = Number.MAX_SAFE_INTEGER;
    for (const sent of sentences(a.text)) {
      const g = trigrams(sent);
      if (!g.size) continue;
      fin.forEach((fg, idx) => {
        let inter = 0;
        for (const t of g) if (fg.has(t)) inter++;
        const j = inter / (g.size + fg.size - inter || 1);
        if (j > best) {
          best = j;
          at = idx;
        }
      });
    }
    return { id: a.id, text: a.text, at };
  });
  return pos
    .sort((x, y) => x.at - y.at)
    .map((p) => p.text.trim())
    .join("\n\n");
}

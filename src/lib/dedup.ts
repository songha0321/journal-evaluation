/**
 * 중복 게재 방지 L2 — 결정적(비-LLM) 근사 중복 판정. SELECTION.md §2 L2 구현.
 * 같은 학생이 여러 질문에 같은 일화를 반복 서술하는 경우를 잡는다.
 */

/** 정규화: 공백·문장부호 제거, 숫자는 유지(점수·시기가 식별력이 높다). */
export function normalizeForHash(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[.,!?~…"'`“”‘’()[\]{}<>·\-—–_/\\:;|+*=^%$#@&]/g, "")
    .toLowerCase();
}

/** 정규화 텍스트의 SHA-256 앞 16자. */
export async function contentHash(text: string): Promise<string> {
  const norm = normalizeForHash(text);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** 문자 n-gram 집합. 한국어는 어절 분리가 불안정해 문자 단위가 안전하다. */
export function charNgrams(text: string, n = 5): Set<string> {
  const s = normalizeForHash(text);
  const out = new Set<string>();
  if (s.length < n) {
    if (s) out.add(s);
    return out;
  }
  for (let i = 0; i <= s.length - n; i++) out.add(s.slice(i, i + n));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const g of small) if (large.has(g)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DUP_EXCLUDE = 0.6; // 이상이면 자동 제외
export const DUP_WARN = 0.4; // 이상이면 경고만

export type DupVerdict = { level: "exclude" | "warn" | "ok"; against: string | null; score: number };

/**
 * 후보 1건을 기존 게재분·같은 배치의 선행 후보들과 비교한다.
 * `existing`은 [식별자, n-gram 집합] 쌍의 배열.
 */
export function checkDuplicate(
  cand: Set<string>,
  existing: { id: string; grams: Set<string>; hash?: string | null }[],
  candHash?: string,
): DupVerdict {
  let best = 0;
  let bestId: string | null = null;
  for (const e of existing) {
    if (candHash && e.hash && candHash === e.hash) return { level: "exclude", against: e.id, score: 1 };
    const s = jaccard(cand, e.grams);
    if (s > best) {
      best = s;
      bestId = e.id;
    }
  }
  if (best >= DUP_EXCLUDE) return { level: "exclude", against: bestId, score: best };
  if (best >= DUP_WARN) return { level: "warn", against: bestId, score: best };
  return { level: "ok", against: null, score: best };
}

/**
 * 사전 랭킹 — LLM에 넘길 후보 수를 줄인다.
 * 목차내용의 문자 2-gram이 질문+답변에 얼마나 나타나는지로 점수를 매긴다.
 * 정교할 필요는 없다. 명백히 무관한 답변을 쳐내는 게 목적이다.
 */
export function prefilterScore(tocContent: string, questionText: string, answerText: string): number {
  const needles = charNgrams(tocContent, 2);
  if (needles.size === 0) return 0;
  const hayQ = normalizeForHash(questionText);
  const hayA = normalizeForHash(answerText);
  let hit = 0;
  for (const g of needles) {
    // 질문에서의 일치는 주제 적합성을 더 강하게 시사하므로 가중치를 둔다.
    if (hayQ.includes(g)) hit += 2;
    else if (hayA.includes(g)) hit += 1;
  }
  return hit / (needles.size * 2);
}

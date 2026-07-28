import { getDB } from "@/lib/db";
import { getToc, listPool, listPublishedEpisodes, type PoolRow } from "@/lib/ax";
import { chatJson } from "@/lib/ai";
import { charNgrams, checkDuplicate, contentHash, prefilterScore } from "@/lib/dedup";

/**
 * AI 수기 선별 엔진 — SELECTION.md 구현.
 * 선별 단위는 qna 행이며, 적용 순서는 L1(SQL) → L2(해시·유사도) → L3(LLM) → 적합성 평가다.
 * 순서를 바꾸면 LLM에 넘길 후보가 줄지 않아 토큰만 낭비된다.
 */

const BATCH = 10;
/** LLM에 넘길 후보 상한. 선별 개수의 8배 또는 60건 중 큰 값. */
function poolCap(selectCount: number): number {
  return Math.max(60, selectCount * 8);
}

const SYS = `당신은 시대인재 <항해일지> 편집국의 수기 선별 에이전트다.

[선별 단위]
평가 대상은 학생 1명이 아니라 "질문 1개 + 답변 1개"(qna 행) 하나다.

[판단 순서]
1) 중복 판정: 아래 [이미 실린 내용]과 같은 에피소드면 is_duplicate=true. 표현이 달라도
   과목/영역·시기·사건·방법론 4요소 중 3개 이상이 겹치면 중복이다.
2) 목차 적합성: 편집자가 쓴 [목차내용]이 요구하는 주제에 이 답변이 답이 되는가.
   적합성이 낮으면 다른 장점이 아무리 커도 선별하지 않는다.
3) 정성·구체성 > 실용성 > 독창성 순으로 가점. 가독성은 탈고로 보완 가능하므로 배제 사유로 쓰지 않는다.

[출력]
후보마다 아래 필드를 가진 객체의 JSON 배열만 출력한다. 설명 문장을 덧붙이지 않는다.
{"qna_id":"<입력값 그대로>","is_duplicate":false,"fit_score":0~5,
 "confidence":"high|medium|low",
 "episode":{"subject":"","period":"","event":"","method":""},
 "reason":"1~2문장. 부정적 지적보다 활용 가능성 중심으로."}

confidence 기준 — high: 탈고만 하면 바로 게재 가능 / medium: 부분 발췌·보완 필요 / low: 관련은 있으나 근거 약함.`;

interface LlmOut {
  qna_id: string;
  is_duplicate?: boolean;
  fit_score?: number;
  confidence?: "high" | "medium" | "low";
  episode?: { subject?: string; period?: string; event?: string; method?: string };
  reason?: string;
}

function episodeLine(e: LlmOut["episode"]): string {
  if (!e) return "";
  return [e.subject, e.period, e.event, e.method].filter(Boolean).join(" · ");
}

export interface ShortlistResult {
  toc_id: string;
  pool: number;
  screened: number;
  saved: number;
  excluded_duplicate: number;
  ai: boolean;
}

export async function shortlistToc(tocId: string): Promise<ShortlistResult> {
  const toc = await getToc(tocId);
  if (!toc) throw new Error("목차를 찾을 수 없습니다.");
  if (!toc.toc_content?.trim()) throw new Error("목차내용이 비어 있습니다.");

  const db = await getDB();
  const cohort = await db
    .prepare(`SELECT cohort FROM ax_issue WHERE id = ?`)
    .bind(toc.issue_id)
    .first<{ cohort: number | null }>();
  if (!cohort?.cohort) throw new Error("호차에 대상 기수가 지정되지 않았습니다.");

  // ── L1: 이미 게재된 qna 행은 SQL 단계에서 제외된다.
  const pool = await listPool(cohort.cohort);

  // ── 사전 랭킹: 목차내용과 무관한 답변을 쳐내 LLM 입력을 줄인다.
  const cap = poolCap(toc.select_count);
  const ranked = pool
    .map((r) => ({ r, s: prefilterScore(toc.toc_content!, r.question_text, r.answer_text) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, cap)
    .map((x) => x.r);

  // ── L2 기준선: 이미 확정된 원고의 지문·해시
  const published = await listPublishedEpisodes();
  const existing: { id: string; grams: Set<string>; hash?: string | null }[] = [];
  const publishedLines: string[] = [];
  for (const p of published) {
    let ep: LlmOut["episode"] | undefined;
    try {
      ep = p.episode_json ? (JSON.parse(p.episode_json) as LlmOut["episode"]) : undefined;
    } catch {
      ep = undefined;
    }
    const line = episodeLine(ep);
    if (line) publishedLines.push(`${p.issue_label} / ${p.toc_title} — ${line}`);
    existing.push({ id: p.toc_id, grams: charNgrams(line || p.toc_title), hash: p.content_hash });
  }

  // ── L3 + 적합성: LLM 배치 호출
  const dupContext = publishedLines.length
    ? `\n\n[이미 실린 내용 — 아래와 중복되는 수기는 절대 선별하지 말 것]\n${publishedLines
        .map((l, i) => `${i + 1}. ${l}`)
        .join("\n")}`
    : "";

  const scored: { row: PoolRow; out: LlmOut }[] = [];
  let usedAi = false;

  for (let i = 0; i < ranked.length; i += BATCH) {
    const batch = ranked.slice(i, i + BATCH);
    const user =
      `[목차] ${toc.part_no ? `Part ${toc.part_no} ` : ""}${toc.chapter_no ? `Chapter ${toc.chapter_no} ` : ""}${toc.title}\n` +
      `[목차내용]\n${toc.toc_content}${dupContext}\n\n[후보]\n` +
      batch
        .map(
          (b) =>
            `---\nqna_id: ${b.qna_id}\n질문: ${b.question_text}\n답변: ${b.answer_text.slice(0, 1800)}`,
        )
        .join("\n");

    const out = await chatJson<LlmOut[]>(SYS, user, 3000).catch(() => null);
    if (out && Array.isArray(out)) {
      usedAi = true;
      const byId = new Map(batch.map((b) => [b.qna_id, b]));
      for (const o of out) {
        const row = byId.get(o.qna_id);
        if (row) scored.push({ row, out: o });
      }
    } else {
      // 폴백: LLM 미설정·실패 시 사전 랭킹 점수를 그대로 사용한다(선별이 멈추지 않게).
      for (const b of batch) {
        const s = prefilterScore(toc.toc_content!, b.question_text, b.answer_text);
        scored.push({
          row: b,
          out: {
            qna_id: b.qna_id,
            is_duplicate: false,
            fit_score: Math.min(5, Math.round(s * 10)),
            confidence: s > 0.25 ? "medium" : "low",
            reason: "규칙 기반 매칭(OPENAI_API_KEY 미설정) — 편집자 확인이 필요합니다.",
          },
        });
      }
    }
  }

  // ── 정렬 후 L2 판정 (앞선 선택과의 중복도 함께 본다)
  scored.sort((a, b) => {
    const conf = (c?: string) => (c === "high" ? 2 : c === "medium" ? 1 : 0);
    return (
      conf(b.out.confidence) - conf(a.out.confidence) ||
      (b.out.fit_score ?? 0) - (a.out.fit_score ?? 0) ||
      b.row.answer_text.length - a.row.answer_text.length
    );
  });

  const rows: {
    qna_id: string;
    author_id: string;
    fit: number;
    conf: string;
    reason: string;
    episode: string | null;
    hash: string;
    rank: number;
    dup: number;
    dupOf: string | null;
    warn: number;
  }[] = [];
  let excluded = 0;
  let rank = 1;

  for (const { row, out } of scored) {
    const hash = await contentHash(row.answer_text);
    const grams = charNgrams(row.answer_text);
    const verdict = checkDuplicate(grams, existing, hash);
    const llmDup = out.is_duplicate === true;
    const isDup = llmDup || verdict.level === "exclude";
    if (isDup) excluded++;

    rows.push({
      qna_id: row.qna_id,
      author_id: row.author_id,
      fit: Math.max(0, Math.min(5, out.fit_score ?? 0)),
      conf: out.confidence ?? "low",
      reason: out.reason ?? "",
      episode: out.episode ? JSON.stringify(out.episode) : null,
      hash,
      rank: isDup ? 9999 : rank++,
      dup: isDup ? 1 : 0,
      dupOf: llmDup ? "llm" : verdict.against,
      warn: verdict.level === "warn" ? 1 : 0,
    });

    // 선택된 후보는 이후 후보의 중복 기준에 추가한다(같은 목차 안에서의 반복도 막는다).
    if (!isDup) existing.push({ id: row.qna_id, grams, hash });
  }

  // ── 저장: 이 목차의 이전 후보는 지우고 새로 쓴다.
  await db.prepare(`DELETE FROM ax_candidate WHERE toc_id = ?`).bind(tocId).run();

  const stmt = db.prepare(
    `INSERT INTO ax_candidate
       (toc_id, qna_id, author_id, fit_score, confidence, reason, episode_json, content_hash,
        rank, is_duplicate, duplicate_of, duplicate_warning)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  if (rows.length) {
    await db.batch(
      rows.map((r) =>
        stmt.bind(
          tocId,
          r.qna_id,
          r.author_id,
          r.fit,
          r.conf,
          r.reason,
          r.episode,
          r.hash,
          r.rank,
          r.dup,
          r.dupOf,
          r.warn,
        ),
      ),
    );
  }

  await db
    .prepare(`UPDATE ax_toc SET shortlisted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(tocId)
    .run();

  return {
    toc_id: tocId,
    pool: pool.length,
    screened: ranked.length,
    saved: rows.length - excluded,
    excluded_duplicate: excluded,
    ai: usedAi,
  };
}

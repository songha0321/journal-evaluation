#!/usr/bin/env node
/**
 * AX 로컬 러너 — 배포된 Worker가 큐에 넣은 AI 작업을 가져가 처리한다.
 *
 * 배경: Cloudflare Worker는 V8 isolate라 CLI를 실행할 수 없다. 그래서 Worker는
 *   ax_toc.shortlist_status = 'queued' 만 기록하고, 이 스크립트가 맥에서 돌면서
 *   실제 선별을 수행한 뒤 결과를 remote D1에 적재한다.
 *
 * 사용법
 *   node scripts/ax-runner.mjs --watch        # 상주하며 큐를 계속 처리 (권장)
 *   node scripts/ax-runner.mjs --once         # 큐를 한 번만 비우고 종료
 *   node scripts/ax-runner.mjs --toc toc_xxx  # 특정 목차 강제 실행
 *
 * LLM 연결 (지금은 비활성 — 규칙 기반 폴백으로 동작)
 *   AX_LLM=claude AX_LLM_MODEL=sonnet node scripts/ax-runner.mjs --watch
 *
 * 규칙 정본은 SELECTION.md. 적용 순서 L1(SQL) → 사전 랭킹 → L2(해시·유사도) → L3(LLM).
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { makeD1, q } from "./lib/d1.mjs";
import { charNgrams, checkDuplicate, contentHash, prefilterScore } from "./lib/dedup.mjs";
import { callJson, isLlmEnabled, llmLabel } from "./lib/llm.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const db = makeD1(REPO);

const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const ONCE = args.includes("--once") || !WATCH;
const FORCE_TOC = args[args.indexOf("--toc") + 1] && args.includes("--toc") ? args[args.indexOf("--toc") + 1] : null;

const POLL_MS = 15000;
const BATCH = 10;
const MIN_LEN = 100;
/** LLM에 넘길 후보 상한. 선별 개수의 8배 또는 60건 중 큰 값. */
const poolCap = (selectCount) => Math.max(60, selectCount * 8);

const log = (s) => process.stdout.write(`${new Date().toTimeString().slice(0, 8)} ${s}\n`);

/* ─────────────────────────────────────────────────────────── 프롬프트 */

const SYS = `당신은 시대인재 <항해일지> 편집국의 수기 선별 에이전트다.

[선별 단위]
평가 대상은 학생 1명이 아니라 "질문 1개 + 답변 1개"(qna 행) 하나다.

[판단 순서]
1) 중복 판정: 아래 [이미 실린 내용]과 같은 에피소드면 is_duplicate=true.
   표현이 달라도 과목/영역·시기·사건·방법론 4요소 중 3개 이상이 겹치면 중복이다.
2) 목차 적합성: 편집자가 쓴 [목차내용]이 요구하는 주제에 이 답변이 답이 되는가.
   적합성이 낮으면 다른 장점이 아무리 커도 선별하지 않는다.
3) 정성·구체성 > 실용성 > 독창성 순으로 가점.
   가독성은 탈고로 보완 가능하므로 배제 사유로 쓰지 않는다.

[출력]
후보마다 아래 필드를 가진 객체의 JSON 배열만 출력한다. 설명 문장을 덧붙이지 않는다.
{"qna_id":"<입력값 그대로>","is_duplicate":false,"fit_score":0~5,
 "confidence":"high|medium|low",
 "episode":{"subject":"","period":"","event":"","method":""},
 "reason":"1~2문장. 부정적 지적보다 활용 가능성 중심으로."}

confidence — high: 탈고만 하면 바로 게재 가능 / medium: 부분 발췌·보완 필요 / low: 관련은 있으나 근거 약함.`;

/* ─────────────────────────────────────────────────────────── 러너 상태 */

async function heartbeat(status, note) {
  await db.exec(
    `UPDATE ax_runner SET last_seen_at = CURRENT_TIMESTAMP, status = ${q(status)},
            note = ${q(note ?? null)}, updated_at = CURRENT_TIMESTAMP WHERE id = 'runner';`,
  );
}

async function setProgress(tocId, progress) {
  await db.exec(`UPDATE ax_toc SET shortlist_progress = ${q(progress)} WHERE id = ${q(tocId)};`);
}

/* ─────────────────────────────────────────────────────────── 선별 */

function episodeLine(e) {
  if (!e) return "";
  return [e.subject, e.period, e.event, e.method].filter(Boolean).join(" · ");
}

async function shortlist(toc) {
  const tocId = toc.id;
  const label = `${toc.part_no ? `Part ${toc.part_no} ` : ""}${toc.chapter_no ? `Chapter ${toc.chapter_no} ` : ""}${toc.title}`;
  log(`▶ 선별 시작: ${label} (목표 ${toc.select_count}건)`);

  await db.exec(
    `UPDATE ax_toc SET shortlist_status='running', shortlist_started_at=CURRENT_TIMESTAMP,
            shortlist_error=NULL WHERE id=${q(tocId)};`,
  );
  await heartbeat("working", `선별: ${label}`);

  if (!toc.cohort) throw new Error("호차에 대상 기수가 지정되지 않았습니다.");
  if (!toc.toc_content?.trim()) throw new Error("목차내용이 비어 있습니다.");

  // ── L1: 이미 게재된 qna 행은 SQL에서 제외된다. 사전 랭킹용으로 앞부분만 가져온다.
  const pool = await db.query(
    `SELECT a.id qna_id, q2.question_text, SUBSTR(a.answer_text,1,600) head
       FROM qna a
       JOIN questions q2 ON q2.id = a.question_id
      WHERE q2.cohort = ${q(toc.cohort)} AND q2.is_active = 1
        AND LENGTH(TRIM(COALESCE(a.answer_text,''))) >= ${MIN_LEN}
        AND a.id NOT IN (SELECT qna_id FROM ax_manuscript);`,
  );
  log(`  후보 풀 ${pool.length}건 (게재분 제외 후)`);
  if (pool.length === 0) throw new Error("후보 풀이 비어 있습니다. 대상 기수를 확인하세요.");

  // ── 사전 랭킹: 목차내용과 무관한 답변을 쳐내 LLM 입력을 줄인다.
  const cap = poolCap(toc.select_count);
  const top = pool
    .map((r) => ({ r, s: prefilterScore(toc.toc_content, r.question_text, r.head ?? "") }))
    .sort((a, b) => b.s - a.s)
    .slice(0, cap);
  log(`  사전 랭킹 → 상위 ${top.length}건 심사`);

  // ── 심사 대상의 전문 + 작성자 정보
  const ids = top.map((x) => q(x.r.qna_id)).join(",");
  const rows = await db.query(
    `SELECT a.id qna_id, a.author_id, q2.question_key, q2.question_text, a.answer_text,
            au.name, au.student_type, au.final_university
       FROM qna a
       JOIN questions q2 ON q2.id = a.question_id
       JOIN authors au   ON au.id = a.author_id
      WHERE a.id IN (${ids});`,
  );
  const order = new Map(top.map((x, i) => [x.r.qna_id, i]));
  rows.sort((a, b) => (order.get(a.qna_id) ?? 0) - (order.get(b.qna_id) ?? 0));

  // ── L2/L3 기준선: 이미 확정된 원고의 지문·해시 (프로젝트 전체, 호차 경계 무관)
  const published = await db.query(
    `SELECT m.qna_id, t.title toc_title, i.issue_label, m.episode_json, m.content_hash
       FROM ax_manuscript m
       JOIN ax_toc t   ON t.id = m.toc_id
       JOIN ax_issue i ON i.id = t.issue_id;`,
  );
  const existing = [];
  const publishedLines = [];
  for (const p of published) {
    let ep = null;
    try {
      ep = p.episode_json ? JSON.parse(p.episode_json) : null;
    } catch {
      ep = null;
    }
    const line = episodeLine(ep);
    if (line) publishedLines.push(`${p.issue_label} / ${p.toc_title} — ${line}`);
    existing.push({ id: p.qna_id, grams: charNgrams(line || p.toc_title), hash: p.content_hash });
  }
  if (publishedLines.length) log(`  기존 게재분 ${publishedLines.length}건과 중복 대조`);

  const dupContext = publishedLines.length
    ? `\n\n[이미 실린 내용 — 아래와 중복되는 수기는 절대 선별하지 말 것]\n${publishedLines
        .map((l, i) => `${i + 1}. ${l}`)
        .join("\n")}`
    : "";

  // ── 배치 심사
  const scored = [];
  const totalBatches = Math.ceil(rows.length / BATCH);
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    await setProgress(tocId, `${n}/${totalBatches} 배치`);

    const user =
      `[목차] ${label}\n[목차내용]\n${toc.toc_content}${dupContext}\n\n[후보]\n` +
      batch
        .map((b) => `---\nqna_id: ${b.qna_id}\n질문: ${b.question_text}\n답변: ${String(b.answer_text).slice(0, 1800)}`)
        .join("\n");

    const out = await callJson(SYS, user);
    if (Array.isArray(out)) {
      const byId = new Map(batch.map((b) => [b.qna_id, b]));
      for (const o of out) {
        const row = byId.get(o.qna_id);
        if (row) scored.push({ row, out: o });
      }
    } else {
      // 폴백: LLM 미연결·실패 시 사전 랭킹 점수를 그대로 쓴다(선별이 멈추지 않게).
      for (const b of batch) {
        const s = prefilterScore(toc.toc_content, b.question_text, b.answer_text);
        scored.push({
          row: b,
          out: {
            qna_id: b.qna_id,
            is_duplicate: false,
            fit_score: Math.min(5, Math.round(s * 10)),
            confidence: s > 0.25 ? "medium" : "low",
            reason: "규칙 기반 매칭(LLM 미연결) — 편집자 확인이 필요합니다.",
          },
        });
      }
    }
    process.stdout.write(`\r  심사 ${Math.min(i + BATCH, rows.length)}/${rows.length}   `);
  }
  process.stdout.write("\n");

  // ── 정렬 후 L2 판정 (앞선 선택과의 중복도 함께 본다)
  const confRank = (c) => (c === "high" ? 2 : c === "medium" ? 1 : 0);
  scored.sort(
    (a, b) =>
      confRank(b.out.confidence) - confRank(a.out.confidence) ||
      (b.out.fit_score ?? 0) - (a.out.fit_score ?? 0) ||
      String(b.row.answer_text).length - String(a.row.answer_text).length,
  );

  const values = [];
  let excluded = 0;
  let rank = 1;
  for (const { row, out } of scored) {
    const hash = contentHash(row.answer_text);
    const grams = charNgrams(row.answer_text);
    const verdict = checkDuplicate(grams, existing, hash);
    const isDup = out.is_duplicate === true || verdict.level === "exclude";
    if (isDup) excluded++;

    values.push(
      `(${[
        q(tocId),
        q(row.qna_id),
        q(row.author_id),
        Math.max(0, Math.min(5, Number(out.fit_score) || 0)),
        q(out.confidence ?? "low"),
        q(out.reason ?? ""),
        q(out.episode ? JSON.stringify(out.episode) : null),
        q(hash),
        isDup ? 9999 : rank++,
        isDup ? 1 : 0,
        q(out.is_duplicate === true ? "llm" : verdict.against),
        verdict.level === "warn" ? 1 : 0,
      ].join(",")})`,
    );

    // 선택된 후보는 이후 후보의 중복 기준에 추가한다(같은 목차 안의 반복도 막는다).
    if (!isDup) existing.push({ id: row.qna_id, grams, hash });
  }

  // ── 저장: 이 목차의 이전 후보는 지우고 새로 쓴다.
  const stmts = [`DELETE FROM ax_candidate WHERE toc_id = ${q(tocId)};`];
  for (let i = 0; i < values.length; i += 200) {
    stmts.push(
      `INSERT INTO ax_candidate
         (toc_id, qna_id, author_id, fit_score, confidence, reason, episode_json, content_hash,
          rank, is_duplicate, duplicate_of, duplicate_warning)
       VALUES ${values.slice(i, i + 200).join(",")};`,
    );
  }
  stmts.push(
    `UPDATE ax_toc SET shortlist_status='done', shortlisted_at=CURRENT_TIMESTAMP,
            shortlist_progress=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=${q(tocId)};`,
  );
  await db.exec(stmts.join("\n"));

  log(`✔ 완료: ${label} — 후보 ${values.length - excluded}건 / 중복 제외 ${excluded}건`);
}

/* ─────────────────────────────────────────────────────────── 큐 루프 */

async function drain() {
  const where = FORCE_TOC
    ? `t.id = ${q(FORCE_TOC)}`
    : `t.shortlist_status = 'queued'`;
  const jobs = await db.query(
    `SELECT t.id, t.title, t.part_no, t.chapter_no, t.toc_content, t.select_count, i.cohort
       FROM ax_toc t JOIN ax_issue i ON i.id = t.issue_id
      WHERE ${where}
      ORDER BY t.shortlist_requested_at, t.part_no, t.chapter_no;`,
  );
  if (jobs.length === 0) return 0;

  log(`큐에 ${jobs.length}건`);
  for (const toc of jobs) {
    try {
      await shortlist(toc);
    } catch (e) {
      const msg = e?.message ?? String(e);
      log(`✖ 실패: ${toc.title} — ${msg}`);
      await db.exec(
        `UPDATE ax_toc SET shortlist_status='error', shortlist_error=${q(msg.slice(0, 500))},
                shortlist_progress=NULL WHERE id=${q(toc.id)};`,
      );
    }
  }
  return jobs.length;
}

async function main() {
  log(`AX 러너 시작 — LLM: ${llmLabel()}`);
  if (!isLlmEnabled()) {
    log("  ⚠ LLM 미연결. 규칙 기반 사전 랭킹으로만 선별합니다.");
    log("    연결: AX_LLM=claude AX_LLM_MODEL=sonnet node scripts/ax-runner.mjs --watch");
  }

  if (ONCE && !WATCH) {
    await heartbeat("working", "1회 실행");
    const n = await drain();
    await heartbeat("idle", n ? `${n}건 처리 완료` : "처리할 작업 없음");
    log("종료");
    return;
  }

  for (;;) {
    try {
      const n = await drain();
      await heartbeat("idle", n ? `${n}건 처리 완료` : "대기 중");
    } catch (e) {
      log(`✖ 루프 오류: ${e?.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  process.stderr.write(`치명적 오류: ${e?.stack ?? e}\n`);
  process.exit(1);
});

import { query, queryOne } from "@/lib/db";

/* ─────────────────────────────────────────────────────────────
   타입 — 위계: Project > Issue(호차) > Toc(목차) > Manuscript(원고)
   선별 단위는 작성자가 아니라 qna 행이다 (SELECTION.md §1).
   ───────────────────────────────────────────────────────────── */

/** AI 작업 큐 상태. 러너(scripts/ax-runner.mjs)가 queued → running → done/error 로 옮긴다. */
export type JobStatus = "idle" | "queued" | "running" | "done" | "error";

export interface Issue {
  id: string;
  project: string;
  issue_label: string;
  sort_order: number;
  status: "editing" | "published" | "archived";
  cohort: number | null;
  created_at: string;
  published_at: string | null;
  toc_count?: number;
  ms_count?: number;
}

export interface Toc {
  id: string;
  issue_id: string;
  part_no: number | null;
  chapter_no: number | null;
  title: string;
  toc_content: string | null;
  hanmadi: string | null;
  select_count: number;
  shortlisted_at: string | null;
  confirmed_at: string | null;
  finalized_at: string | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
  /* AI 작업 큐 (0011) — Worker는 요청만 적고 로컬 러너가 처리한다 */
  shortlist_status: JobStatus;
  shortlist_requested_at: string | null;
  shortlist_started_at: string | null;
  shortlist_progress: string | null;
  shortlist_error: string | null;
  /* 집계 */
  cand_count?: number;
  ms_count?: number;
  revised_count?: number;
  composed_count?: number;
  final_count?: number;
  needs_review_count?: number;
  last_edited_at?: string | null;
  /* 조인 */
  project?: string;
  issue_label?: string;
}

export interface Candidate {
  id: string;
  toc_id: string;
  qna_id: string;
  author_id: string;
  fit_score: number | null;
  confidence: "high" | "medium" | "low" | null;
  reason: string | null;
  episode_json: string | null;
  rank: number | null;
  is_duplicate: number;
  duplicate_warning: number;
  /* 조인 — 후보 카드에 필요한 3종 (SELECTION.md §5) */
  question_key: string | null;
  question_text: string;
  answer_text: string | null;
  name: string;
  student_type: string | null;
  final_university: string | null;
  cohort: number | null;
  total_score: number | null;
  picked?: number;
}

export interface Manuscript {
  id: string;
  toc_id: string;
  author_id: string;
  qna_id: string;
  content_hash: string | null;
  episode_json: string | null;
  select_reason: string | null;
  subtitle: string | null;
  comment: string | null;
  edited_text: string | null;
  revision_json: string | null;
  highlights_json: string | null;
  status: "confirmed" | "edited" | "final";
  needs_review: number;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  /* 조인 */
  name?: string;
  student_type?: string | null;
  final_university?: string | null;
  total_score?: number | null;
  question_key?: string | null;
  question_text?: string;
  answer_text?: string | null;
}

/** 목차 표기: `Part 2 Chapter 1. 상반기 공부법` (Chapter 없으면 Part만) */
export function tocLabel(t: Pick<Toc, "part_no" | "chapter_no" | "title">): string {
  const seg = [t.part_no ? `Part ${t.part_no}` : "", t.chapter_no ? `Chapter ${t.chapter_no}` : ""]
    .filter(Boolean)
    .join(" ");
  return seg ? `${seg}. ${t.title}` : t.title;
}

/* ─────────────────────────────────────────────────────────────
   호차
   ───────────────────────────────────────────────────────────── */

const ISSUE_AGG = `
  (SELECT COUNT(*) FROM ax_toc t WHERE t.issue_id = i.id) toc_count,
  (SELECT COUNT(*) FROM ax_manuscript m JOIN ax_toc t ON t.id = m.toc_id WHERE t.issue_id = i.id) ms_count`;

export async function listIssues(status?: Issue["status"]): Promise<Issue[]> {
  const where = status ? `WHERE i.status = ?` : "";
  return query<Issue>(
    `SELECT i.*, ${ISSUE_AGG} FROM ax_issue i ${where} ORDER BY i.sort_order, i.created_at`,
    status ? [status] : [],
  );
}

export async function getIssue(id: string): Promise<Issue | null> {
  return queryOne<Issue>(`SELECT i.*, ${ISSUE_AGG} FROM ax_issue i WHERE i.id = ?`, [id]);
}

/* ─────────────────────────────────────────────────────────────
   목차 — 진행 단계 집계를 한 쿼리로 가져온다 (PROCESS.md §3.1)
   ───────────────────────────────────────────────────────────── */

const TOC_AGG = `
  (SELECT COUNT(*) FROM ax_candidate c WHERE c.toc_id = t.id AND c.is_duplicate = 0) cand_count,
  (SELECT COUNT(*) FROM ax_manuscript m WHERE m.toc_id = t.id) ms_count,
  (SELECT COUNT(*) FROM ax_manuscript m WHERE m.toc_id = t.id
     AND TRIM(COALESCE(m.edited_text,'')) <> '') revised_count,
  (SELECT COUNT(*) FROM ax_manuscript m WHERE m.toc_id = t.id
     AND TRIM(COALESCE(m.edited_text,'')) <> ''
     AND TRIM(COALESCE(m.subtitle,''))   <> ''
     AND TRIM(COALESCE(m.comment,''))    <> '') composed_count,
  (SELECT COUNT(*) FROM ax_manuscript m WHERE m.toc_id = t.id AND m.status = 'final') final_count,
  (SELECT COUNT(*) FROM ax_manuscript m WHERE m.toc_id = t.id AND m.needs_review = 1) needs_review_count,
  (SELECT MAX(m.updated_at) FROM ax_manuscript m WHERE m.toc_id = t.id) last_edited_at`;

/** 목차 목록. 파트 → 챕터 오름차순 (NULL은 뒤로). */
export async function listTocsByIssue(issueId: string): Promise<Toc[]> {
  return query<Toc>(
    `SELECT t.*, ${TOC_AGG} FROM ax_toc t WHERE t.issue_id = ?
     ORDER BY (t.part_no IS NULL), t.part_no, (t.chapter_no IS NULL), t.chapter_no, t.created_at`,
    [issueId],
  );
}

export async function listAllTocs(): Promise<Toc[]> {
  return query<Toc>(
    `SELECT t.*, i.project, i.issue_label, ${TOC_AGG}
     FROM ax_toc t JOIN ax_issue i ON i.id = t.issue_id
     ORDER BY i.sort_order, (t.part_no IS NULL), t.part_no, (t.chapter_no IS NULL), t.chapter_no`,
  );
}

export async function getToc(id: string): Promise<Toc | null> {
  return queryOne<Toc>(
    `SELECT t.*, i.project, i.issue_label, ${TOC_AGG}
     FROM ax_toc t JOIN ax_issue i ON i.id = t.issue_id WHERE t.id = ?`,
    [id],
  );
}

/* ─────────────────────────────────────────────────────────────
   후보 · 원고
   ───────────────────────────────────────────────────────────── */

const CAND_JOIN = `
  FROM ax_candidate c
  JOIN qna n        ON n.id = c.qna_id
  JOIN questions q  ON q.id = n.question_id
  JOIN authors a    ON a.id = c.author_id
  LEFT JOIN evaluations e ON e.author_id = a.id`;

/** 목차의 AI 선별 후보. 요청 개수만큼만 노출하되 초과분은 대기로 보관한다(SELECTION.md §3.3). */
export async function listCandidatesByToc(tocId: string, limit?: number): Promise<Candidate[]> {
  return query<Candidate>(
    `SELECT c.*, q.question_key, q.question_text, n.answer_text,
            a.name, a.student_type, a.final_university, a.cohort, e.total_score,
            (SELECT COUNT(*) FROM ax_manuscript m WHERE m.qna_id = c.qna_id) picked
     ${CAND_JOIN}
     WHERE c.toc_id = ? AND c.is_duplicate = 0
     ORDER BY (c.rank IS NULL), c.rank, c.fit_score DESC
     ${limit ? "LIMIT ?" : ""}`,
    limit ? [tocId, limit] : [tocId],
  );
}

export async function listManuscriptsByToc(tocId: string): Promise<Manuscript[]> {
  return query<Manuscript>(
    `SELECT m.*, a.name, a.student_type, a.final_university, e.total_score,
            q.question_key, q.question_text, n.answer_text
     FROM ax_manuscript m
     JOIN authors a   ON a.id = m.author_id
     JOIN qna n       ON n.id = m.qna_id
     JOIN questions q ON q.id = n.question_id
     LEFT JOIN evaluations e ON e.author_id = a.id
     WHERE m.toc_id = ?
     ORDER BY m.created_at`,
    [tocId],
  );
}

export async function getManuscript(id: string): Promise<Manuscript | null> {
  return queryOne<Manuscript>(
    `SELECT m.*, a.name, a.student_type, a.final_university, e.total_score,
            q.question_key, q.question_text, n.answer_text
     FROM ax_manuscript m
     JOIN authors a   ON a.id = m.author_id
     JOIN qna n       ON n.id = m.qna_id
     JOIN questions q ON q.id = n.question_id
     LEFT JOIN evaluations e ON e.author_id = a.id
     WHERE m.id = ?`,
    [id],
  );
}

/* ─────────────────────────────────────────────────────────────
   선별 후보 풀 — SELECTION.md §2 L1 (이미 게재된 qna 행 제외)
   ───────────────────────────────────────────────────────────── */

export interface PoolRow {
  qna_id: string;
  author_id: string;
  question_key: string | null;
  question_text: string;
  answer_text: string;
  name: string;
  student_type: string | null;
  final_university: string | null;
  cohort: number;
  total_score: number | null;
}

/**
 * 선별 후보 풀. 호차 전체(다른 목차 포함)에서 이미 확정된 qna 행은 제외한다.
 * 제외 범위는 프로젝트 전체 — 호차·파트 경계를 넘어 중복을 막는다.
 */
export async function listPool(cohort: number, minLen = 100): Promise<PoolRow[]> {
  return query<PoolRow>(
    `SELECT n.id qna_id, n.author_id, q.question_key, q.question_text, n.answer_text,
            a.name, a.student_type, a.final_university, q.cohort, e.total_score
     FROM qna n
     JOIN questions q ON q.id = n.question_id
     JOIN authors a   ON a.id = n.author_id
     LEFT JOIN evaluations e ON e.author_id = a.id
     WHERE q.cohort = ?
       AND q.is_active = 1
       AND LENGTH(TRIM(COALESCE(n.answer_text,''))) >= ?
       AND n.id NOT IN (SELECT qna_id FROM ax_manuscript)`,
    [cohort, minLen],
  );
}

/** 후보 풀 크기만 센다(화면 표시용). 실제 선별은 로컬 러너가 수행한다. */
export async function countPool(cohort: number, minLen = 100): Promise<number> {
  const r = await queryOne<{ n: number }>(
    `SELECT COUNT(*) n
     FROM qna a
     JOIN questions q ON q.id = a.question_id
     WHERE q.cohort = ? AND q.is_active = 1
       AND LENGTH(TRIM(COALESCE(a.answer_text,''))) >= ?
       AND a.id NOT IN (SELECT qna_id FROM ax_manuscript)`,
    [cohort, minLen],
  );
  return r?.n ?? 0;
}

/* ─────────────────────────────────────────────────────────────
   러너 생존 신호 — 큐에만 쌓이고 있는 상황을 화면에서 바로 알아채기 위함
   ───────────────────────────────────────────────────────────── */

export interface RunnerState {
  last_seen_at: string | null;
  status: string | null;
  note: string | null;
}

export async function getRunnerState(): Promise<RunnerState | null> {
  return queryOne<RunnerState>(`SELECT last_seen_at, status, note FROM ax_runner WHERE id = 'runner'`);
}

/** 러너를 살아있다고 볼 최대 무응답 시간(초). 이보다 오래면 화면에 경고를 띄운다. */
export const RUNNER_STALE_SEC = 180;

export function runnerAgeSec(last: string | null | undefined): number | null {
  if (!last) return null;
  const t = Date.parse(last.includes("T") ? last : last.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

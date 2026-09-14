import { query, queryOne } from "@/lib/db";

/* ── 데이터 대시보드: 기수 준비율 (PROCESS.md 트랙 A) ───────────────── */

export interface CohortReadiness {
  cohort: number;
  authors: number;
  submissions: number;
  evaluated: number;
  selected: number;
}

export async function getCohortReadiness(): Promise<CohortReadiness[]> {
  return query<CohortReadiness>(
    `SELECT a.cohort,
            COUNT(DISTINCT a.id) AS authors,
            COUNT(DISTINCT s.id) AS submissions,
            COUNT(DISTINCT e.author_id) AS evaluated,
            COUNT(DISTINCT CASE WHEN e.is_selected = 1 THEN e.author_id END) AS selected
     FROM authors a
     LEFT JOIN submissions s ON s.author_id = a.id
     LEFT JOIN evaluations e ON e.author_id = a.id
     GROUP BY a.cohort
     ORDER BY a.cohort`,
  );
}

/* ── 수기 DB (qna) ───────────────────────────────────────────────── */

export interface QnaFilters {
  cohort?: number;
  questionId?: string;
  q?: string;
  page: number;
  pageSize?: number;
}

export const QNA_PAGE_SIZE = 50;

export interface QnaListRow {
  id: string;
  author_id: string;
  name: string;
  cohort: number;
  student_type: string | null;
  question_id: string;
  question_text: string;
  category: string | null;
  answer_text: string | null;
  answer_len: number;
}

function qnaWhere(f: QnaFilters): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.cohort != null) {
    where.push("a.cohort = ?");
    params.push(f.cohort);
  }
  if (f.questionId) {
    where.push("n.question_id = ?");
    params.push(f.questionId);
  }
  if (f.q) {
    where.push("(n.answer_text LIKE ? OR a.name LIKE ?)");
    params.push(`%${f.q}%`, `%${f.q}%`);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listQna(f: QnaFilters): Promise<{ rows: QnaListRow[]; total: number }> {
  const { sql, params } = qnaWhere(f);
  const from = `FROM qna n JOIN authors a ON a.id = n.author_id JOIN questions q ON q.id = n.question_id ${sql}`;
  const [rows, count] = await Promise.all([
    query<QnaListRow>(
      `SELECT n.id, a.id AS author_id, a.name, a.cohort, a.student_type,
              q.id AS question_id, q.question_text, q.category,
              n.answer_text, LENGTH(COALESCE(n.answer_text, '')) AS answer_len
       ${from}
       ORDER BY a.cohort DESC, a.name, q.sort_order
       LIMIT ? OFFSET ?`,
      [...params, f.pageSize ?? QNA_PAGE_SIZE, (f.page - 1) * (f.pageSize ?? QNA_PAGE_SIZE)],
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${from}`, params),
  ]);
  return { rows, total: count?.n ?? 0 };
}

export interface QuestionOption {
  id: string;
  cohort: number;
  question_text: string;
  sort_order: number;
}

/** 질문 필터 옵션. 기수를 고르면 그 기수 질문만, 아니면 전체. */
export async function listQuestionOptions(cohort?: number): Promise<QuestionOption[]> {
  const where = cohort != null ? "WHERE cohort = ?" : "";
  return query<QuestionOption>(
    `SELECT id, cohort, question_text, sort_order FROM questions ${where} ORDER BY cohort, sort_order`,
    cohort != null ? [cohort] : [],
  );
}

export async function listCohorts(): Promise<number[]> {
  const rows = await query<{ cohort: number }>(`SELECT DISTINCT cohort FROM authors ORDER BY cohort`);
  return rows.map((r) => r.cohort);
}

/* ── 수기 질문지 DB (questions) ───────────────────────────────────── */

export interface QuestionRow {
  id: string;
  cohort: number;
  question_key: string | null;
  question_text: string;
  category: string | null;
  sort_order: number;
  is_active: number;
  answers: number;
  avg_len: number | null;
}

export async function listQuestions(cohort?: number): Promise<QuestionRow[]> {
  const where = cohort != null ? "WHERE q.cohort = ?" : "";
  return query<QuestionRow>(
    `SELECT q.id, q.cohort, q.question_key, q.question_text, q.category, q.sort_order, q.is_active,
            COUNT(n.id) AS answers,
            ROUND(AVG(LENGTH(n.answer_text))) AS avg_len
     FROM questions q
     LEFT JOIN qna n ON n.question_id = q.id
     ${where}
     GROUP BY q.id
     ORDER BY q.cohort, q.sort_order`,
    cohort != null ? [cohort] : [],
  );
}

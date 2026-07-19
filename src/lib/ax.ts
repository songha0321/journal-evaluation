import { query, queryOne } from "@/lib/db";

export interface Toc {
  id: string;
  project: string;
  issue: string;
  part_no: number | null;
  chapter_no: number | null;
  title: string;
  toc_content: string | null;
  hanmadi: string | null;
  cohort: number | null;
  select_count: number;
  created_at: string;
  ms_count?: number;
}

export interface Candidate {
  author_id: string;
  name: string;
  student_type: string | null;
  final_university: string | null;
  cohort: number | null;
  total_score: number | null;
  is_selected: number | null;
  evaluation_summary: string | null;
  answered: number;
}

export interface Manuscript {
  id: string;
  toc_id: string;
  author_id: string;
  submission_id: string | null;
  subtitle: string | null;
  comment: string | null;
  edited_text: string | null;
  highlights_json: string | null;
  status: string;
  updated_at: string;
  name?: string;
  final_university?: string | null;
  student_type?: string | null;
  total_score?: number | null;
}

export function tocLabel(t: Toc): string {
  const p = t.part_no ? `Part ${t.part_no}` : "";
  const c = t.chapter_no ? ` Chapter ${t.chapter_no}` : "";
  return `${[p + c].filter(Boolean).join("")}${p || c ? ". " : ""}${t.title}`.trim();
}

export async function listTocs(): Promise<Toc[]> {
  return query<Toc>(
    `SELECT t.*, (SELECT COUNT(*) FROM ax_manuscript m WHERE m.toc_id = t.id) ms_count
     FROM ax_toc t ORDER BY t.created_at DESC`,
  );
}

export async function getToc(id: string): Promise<Toc | null> {
  return queryOne<Toc>(`SELECT * FROM ax_toc WHERE id = ?`, [id]);
}

export async function listCohorts(): Promise<{ cohort: number; n: number }[]> {
  return query<{ cohort: number; n: number }>(
    `SELECT cohort, COUNT(*) n FROM authors WHERE cohort IS NOT NULL GROUP BY cohort ORDER BY cohort DESC`,
  );
}

export async function listQuestions(
  cohort: number,
): Promise<{ id: string; question_key: string | null; question_text: string; category: string | null }[]> {
  return query<{ id: string; question_key: string | null; question_text: string; category: string | null }>(
    `SELECT id, question_key, question_text, category FROM questions
     WHERE cohort = ? AND is_active = 1 ORDER BY sort_order, question_key`,
    [cohort],
  );
}

/** 후보 수기: 해당 기수 authors + 최고 total_score 평가. 점수 내림차순. */
export async function listCandidates(cohort: number, studentType?: string): Promise<Candidate[]> {
  const params: unknown[] = [cohort];
  let typeClause = "";
  if (studentType) {
    typeClause = " AND a.student_type = ?";
    params.push(studentType);
  }
  return query<Candidate>(
    `SELECT a.id author_id, a.name, a.student_type, a.final_university, a.cohort,
            e.total_score, e.is_selected, e.evaluation_summary,
            (SELECT COUNT(*) FROM qna q WHERE q.author_id = a.id) answered
     FROM authors a
     LEFT JOIN evaluations e ON e.author_id = a.id
     WHERE a.cohort = ?${typeClause}
     ORDER BY (e.total_score IS NULL), e.total_score DESC, a.name`,
    params,
  );
}

/** 원문: 작성자의 qna 답변을 질문과 함께 하나의 텍스트로 조립. */
export async function assembleOriginal(authorId: string): Promise<string> {
  const rows = await query<{ question_text: string; question_key: string | null; answer_text: string | null }>(
    `SELECT q.question_text, q.question_key, n.answer_text
     FROM qna n JOIN questions q ON q.id = n.question_id
     WHERE n.author_id = ? AND n.answer_text IS NOT NULL AND TRIM(n.answer_text) <> ''
     ORDER BY q.sort_order, q.question_key`,
    [authorId],
  );
  return rows
    .map((r) => `[${r.question_key ?? ""}] ${r.question_text}\n${(r.answer_text ?? "").trim()}`)
    .join("\n\n");
}

export async function listManuscriptsByToc(tocId: string): Promise<Manuscript[]> {
  return query<Manuscript>(
    `SELECT m.*, a.name, a.final_university, a.student_type, e.total_score
     FROM ax_manuscript m
     JOIN authors a ON a.id = m.author_id
     LEFT JOIN evaluations e ON e.author_id = a.id
     WHERE m.toc_id = ? ORDER BY e.total_score DESC, a.name`,
    [tocId],
  );
}

export async function getManuscript(id: string): Promise<Manuscript | null> {
  return queryOne<Manuscript>(
    `SELECT m.*, a.name, a.final_university, a.student_type, e.total_score
     FROM ax_manuscript m
     JOIN authors a ON a.id = m.author_id
     LEFT JOIN evaluations e ON e.author_id = a.id
     WHERE m.id = ?`,
    [id],
  );
}

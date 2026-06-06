import { query, queryOne } from "@/lib/db";
import * as M from "@/lib/mockData";
import type { Author, EssayRow, QnaItem, Evaluation, Submission } from "@/types/entities";

export interface EssayFilters {
  cohort?: number;
  studentType?: string;
  university?: string;
  minScore?: number;
  q?: string;
}

/** 수기(Essay) 목록 — one row per author with submission + qna + eval summary. */
export async function listEssays(filters: EssayFilters): Promise<EssayRow[]> {
  if (M.USE_MOCK) {
    return M.mockEssays.filter(
      (e) =>
        (filters.cohort == null || e.cohort === filters.cohort) &&
        (!filters.studentType || e.student_type === filters.studentType) &&
        (!filters.university || (e.final_university ?? "").includes(filters.university)) &&
        (filters.minScore == null || (e.total_score ?? 0) >= filters.minScore) &&
        (!filters.q || e.name.includes(filters.q)),
    );
  }
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.cohort != null) {
    where.push("a.cohort = ?");
    params.push(filters.cohort);
  }
  if (filters.studentType) {
    where.push("a.student_type = ?");
    params.push(filters.studentType);
  }
  if (filters.university) {
    where.push("a.final_university LIKE ?");
    params.push(`%${filters.university}%`);
  }
  if (filters.q) {
    where.push("a.name LIKE ?");
    params.push(`%${filters.q}%`);
  }
  // minScore filters on the aggregated eval, so it goes in HAVING.
  const having = filters.minScore != null ? "HAVING MAX(ev.total_score) >= ?" : "";
  if (filters.minScore != null) params.push(filters.minScore);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return query<EssayRow>(
    `SELECT
       a.id, a.name, a.cohort, a.student_type, a.final_university,
       a.ai_evaluation_grade, a.manual_rating,
       MAX(s.status)        AS submission_status,
       MAX(s.file_url)      AS file_url,
       COUNT(DISTINCT q.id) AS qna_count,
       MAX(ev.total_score)        AS total_score,
       MAX(ev.specificity_score)  AS specificity_score,
       MAX(ev.authenticity_score) AS authenticity_score,
       MAX(ev.narrative_score)    AS narrative_score,
       MAX(ev.usefulness_score)   AS usefulness_score,
       MAX(ev.ai_suspicion_level) AS ai_suspicion_level,
       a.scholarship_amount       AS scholarship_amount
     FROM authors a
     LEFT JOIN submissions s ON s.author_id = a.id
     LEFT JOIN qna q         ON q.author_id = a.id
     LEFT JOIN evaluations ev ON ev.author_id = a.id
     ${whereSql}
     GROUP BY a.id
     ${having}
     ORDER BY a.cohort DESC, total_score DESC
     LIMIT 300`,
    params,
  );
}

/** Distinct values for the filter dropdowns. */
export async function getEssayFilterOptions(): Promise<{
  cohorts: number[];
  studentTypes: string[];
}> {
  if (M.USE_MOCK)
    return { cohorts: [5, 6, 7, 8, 9], studentTypes: ["성적우수", "성적향상", "포레스트", "우선선발"] };
  const cohorts = await query<{ cohort: number }>(
    `SELECT DISTINCT cohort FROM authors ORDER BY cohort`,
  );
  const types = await query<{ student_type: string }>(
    `SELECT DISTINCT student_type FROM authors WHERE student_type IS NOT NULL ORDER BY student_type`,
  );
  return {
    cohorts: cohorts.map((c) => c.cohort),
    studentTypes: types.map((t) => t.student_type),
  };
}

export async function getAuthor(authorId: string): Promise<Author | null> {
  if (M.USE_MOCK) return { ...M.mockAuthor, id: authorId };
  return queryOne<Author>(`SELECT * FROM authors WHERE id = ?`, [authorId]);
}

export async function getAuthorSubmissions(authorId: string): Promise<Submission[]> {
  if (M.USE_MOCK)
    return [
      {
        id: "mock-s-0",
        author_id: authorId,
        source_type: "google_form",
        original_file_name: "answer_mock.hwp",
        file_url: "https://example.com/file",
        status: "selected",
        submitted_at: "2026-05-20",
      },
    ];
  return query<Submission>(
    `SELECT id, author_id, source_type, original_file_name, file_url, status, submitted_at
     FROM submissions WHERE author_id = ? ORDER BY submitted_at`,
    [authorId],
  );
}

/** qna joined to questions (question_text lives only on questions), cohort sort order. */
export async function getAuthorQna(authorId: string): Promise<QnaItem[]> {
  if (M.USE_MOCK) return M.mockQna;
  return query<QnaItem>(
    `SELECT q.id AS question_id, q.question_text, q.category, q.sort_order, n.answer_text
     FROM qna n
     JOIN questions q ON q.id = n.question_id
     WHERE n.author_id = ?
     ORDER BY q.sort_order, q.id`,
    [authorId],
  );
}

export async function getAuthorEvaluations(authorId: string): Promise<Evaluation[]> {
  if (M.USE_MOCK) return M.mockEvaluationsForAuthor;
  return query<Evaluation>(
    `SELECT * FROM evaluations WHERE author_id = ? ORDER BY created_at DESC`,
    [authorId],
  );
}

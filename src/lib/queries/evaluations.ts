import { query } from "@/lib/db";
import * as M from "@/lib/mockData";

export interface EvaluationRow {
  evaluation_id: string;
  author_id: string;
  name: string;
  cohort: number;
  student_type: string | null;
  final_university: string | null;
  total_score: number | null;
  specificity_score: number | null;
  authenticity_score: number | null;
  narrative_score: number | null;
  usefulness_score: number | null;
  ai_suspicion_level: string | null;
  evaluation_summary: string | null;
  scholarship_amount: number | null;
}

/** 평가/선별 비교 — one row per evaluation, sorted by score desc. */
export async function listEvaluations(cohort?: number): Promise<EvaluationRow[]> {
  if (M.USE_MOCK)
    return M.mockEvaluationRows
      .filter((r) => cohort == null || r.cohort === cohort)
      .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
  const where = cohort != null ? "WHERE a.cohort = ?" : "";
  const params = cohort != null ? [cohort] : [];
  return query<EvaluationRow>(
    `SELECT e.id AS evaluation_id, a.id AS author_id, a.name, a.cohort,
            a.student_type, a.final_university,
            e.total_score, e.specificity_score, e.authenticity_score,
            e.narrative_score, e.usefulness_score,
            e.ai_suspicion_level, e.evaluation_summary, a.scholarship_amount
     FROM evaluations e
     JOIN authors a ON a.id = e.author_id
     ${where}
     ORDER BY e.total_score DESC, a.name
     LIMIT 500`,
    params,
  );
}

export async function getEvaluationCohorts(): Promise<number[]> {
  if (M.USE_MOCK) return [5, 6, 7, 8, 9];
  const rows = await query<{ cohort: number }>(
    `SELECT DISTINCT a.cohort FROM evaluations e JOIN authors a ON a.id = e.author_id ORDER BY a.cohort`,
  );
  return rows.map((r) => r.cohort);
}

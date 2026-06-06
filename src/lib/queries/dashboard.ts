import { query } from "@/lib/db";
import * as M from "@/lib/mockData";

export interface CohortCount {
  cohort: number;
  authors: number;
  qna: number;
  evaluations: number;
}

export interface CohortFee {
  cohort: number;
  total_fee: number;
  fee_authors: number;
}

export interface StatusCount {
  label: string;
  n: number;
}

export async function getCohortCounts(): Promise<CohortCount[]> {
  if (M.USE_MOCK) return M.mockCohortCounts;
  return query<CohortCount>(
    `SELECT a.cohort,
            COUNT(DISTINCT a.id) AS authors,
            COUNT(DISTINCT q.id) AS qna,
            COUNT(DISTINCT e.id) AS evaluations
     FROM authors a
     LEFT JOIN qna q         ON q.author_id = a.id
     LEFT JOIN evaluations e ON e.author_id = a.id
     GROUP BY a.cohort
     ORDER BY a.cohort`,
  );
}

export async function getCohortFees(): Promise<CohortFee[]> {
  if (M.USE_MOCK) return M.mockCohortFees;
  // 장학금은 authors.scholarship_amount 로 통합됨(0006). author당 1행이라 단순 합산.
  return query<CohortFee>(
    `SELECT a.cohort,
            COALESCE(SUM(a.scholarship_amount), 0)                 AS total_fee,
            COUNT(CASE WHEN a.scholarship_amount > 0 THEN 1 END)   AS fee_authors
     FROM authors a
     GROUP BY a.cohort
     ORDER BY a.cohort`,
  );
}

export async function getSubmissionStatusRollup(): Promise<StatusCount[]> {
  if (M.USE_MOCK) return M.mockSubmissionRollup;
  return query<StatusCount>(
    `SELECT status AS label, COUNT(*) AS n FROM submissions GROUP BY status ORDER BY n DESC`,
  );
}

export async function getArticleStatusRollup(): Promise<StatusCount[]> {
  if (M.USE_MOCK) return M.mockArticleRollup;
  return query<StatusCount>(
    `SELECT article_status AS label, COUNT(*) AS n FROM articles GROUP BY article_status ORDER BY n DESC`,
  );
}

export async function getAiSuspicionRollup(): Promise<StatusCount[]> {
  if (M.USE_MOCK) return M.mockAiSuspicionRollup;
  return query<StatusCount>(
    `SELECT ai_suspicion_level AS label, COUNT(*) AS n
     FROM evaluations
     WHERE ai_suspicion_level IS NOT NULL
     GROUP BY ai_suspicion_level`,
  );
}

export interface Totals {
  authors: number;
  submissions: number;
  qna: number;
  evaluations: number;
  articles: number;
}

export async function getTotals(): Promise<Totals> {
  if (M.USE_MOCK) return M.mockTotals;
  const rows = await query<Totals>(
    `SELECT
       (SELECT COUNT(*) FROM authors)     AS authors,
       (SELECT COUNT(*) FROM submissions) AS submissions,
       (SELECT COUNT(*) FROM qna)         AS qna,
       (SELECT COUNT(*) FROM evaluations) AS evaluations,
       (SELECT COUNT(*) FROM articles)    AS articles`,
  );
  return rows[0] ?? { authors: 0, submissions: 0, qna: 0, evaluations: 0, articles: 0 };
}

import { query, queryOne } from "@/lib/db";
import { similarity } from "@/lib/compare";
import type { RevisionKind } from "@/lib/revision";

export interface SourceCandidate {
  qna_id: string;
  author_id: string;
  author_name: string;
  cohort: number;
  question_key: string | null;
  question_text: string;
  answer_text: string;
  score: number;
}

/**
 * 같은 작성자(author_id) + 같은 기수의 동명이인 작성자의 답변 전부를 탈고문과 비교해 상위 후보를 돌려준다.
 * 40건 안팎이라 즉석 계산으로 충분하다.
 */
export async function findSourceCandidates(
  articleId: string,
  authorId: string,
  authorName: string | null,
  finalContent: string,
  limit = 3,
): Promise<SourceCandidate[]> {
  const rows = await query<Omit<SourceCandidate, "score">>(
    `SELECT n.id AS qna_id, a.id AS author_id, a.name AS author_name, a.cohort,
            q.question_key, q.question_text, n.answer_text
     FROM qna n
     JOIN authors a ON a.id = n.author_id
     JOIN questions q ON q.id = n.question_id
     WHERE (a.id = ? OR (? IS NOT NULL AND a.name = ? AND a.cohort = (SELECT cohort FROM authors WHERE id = ?)))
       AND n.answer_text IS NOT NULL AND LENGTH(n.answer_text) >= 80`,
    [authorId, authorName, authorName, authorId],
  );
  return rows
    .map((r) => ({ ...r, score: similarity(r.answer_text, finalContent) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

export async function getQna(qnaId: string): Promise<SourceCandidate | null> {
  return queryOne<SourceCandidate>(
    `SELECT n.id AS qna_id, a.id AS author_id, a.name AS author_name, a.cohort,
            q.question_key, q.question_text, n.answer_text, 0 AS score
     FROM qna n JOIN authors a ON a.id = n.author_id JOIN questions q ON q.id = n.question_id
     WHERE n.id = ?`,
    [qnaId],
  );
}

export interface EditComment {
  id: string;
  article_id: string;
  edit_key: string;
  author_email: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export async function listEditComments(articleId: string): Promise<EditComment[]> {
  return query<EditComment>(`SELECT * FROM ax_edit_comment WHERE article_id = ? ORDER BY created_at`, [articleId]);
}

export async function listEditLabels(articleId: string): Promise<Record<string, RevisionKind>> {
  const rows = await query<{ edit_key: string; kind: RevisionKind }>(
    `SELECT edit_key, kind FROM ax_edit_label WHERE article_id = ?`,
    [articleId],
  );
  return Object.fromEntries(rows.map((r) => [r.edit_key, r.kind]));
}

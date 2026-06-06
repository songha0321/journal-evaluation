import { query, queryOne } from "@/lib/db";
import * as M from "@/lib/mockData";
import type { Article } from "@/types/entities";

export interface ArticleListRow {
  id: string;
  author_id: string;
  name: string;
  cohort: number;
  title: string | null;
  article_status: string;
  editor_name: string | null;
  updated_at: string | null;
}

/**
 * 원고 목록 — articles 테이블은 1차 시점 0행이라, 작업자가 원고를 시작할 후보로
 * 선별(또는 평가 상위) author를 함께 노출한다. 우선 기존 article을 보여주고,
 * 없으면 평가 상위 author를 원고 대상 후보로 보여준다.
 */
export async function listArticles(): Promise<ArticleListRow[]> {
  if (M.USE_MOCK) return M.mockArticleList;
  const existing = await query<ArticleListRow>(
    `SELECT ar.id, ar.author_id, a.name, a.cohort, ar.title, ar.article_status,
            ar.editor_name, ar.updated_at
     FROM articles ar JOIN authors a ON a.id = ar.author_id
     ORDER BY ar.updated_at DESC`,
  );
  if (existing.length > 0) return existing;

  // Fallback: 선별 기준(총점 상위) author를 원고 후보로 (article 없음 = 초안 대기).
  return query<ArticleListRow>(
    `SELECT NULL AS id, a.id AS author_id, a.name, a.cohort,
            NULL AS title, 'draft' AS article_status,
            NULL AS editor_name, NULL AS updated_at
     FROM authors a
     JOIN evaluations e ON e.author_id = a.id
     WHERE e.total_score >= 80
     GROUP BY a.id
     ORDER BY a.cohort DESC, MAX(e.total_score) DESC
     LIMIT 100`,
  );
}

export async function getArticleByAuthor(authorId: string): Promise<Article | null> {
  if (M.USE_MOCK) return M.mockArticleByAuthor(authorId);
  return queryOne<Article>(
    `SELECT id, author_id, submission_id, title, draft_content, edited_content,
            final_content, article_status, editor_name, editor_note, updated_at
     FROM articles WHERE author_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [authorId],
  );
}

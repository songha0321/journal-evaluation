import { query, queryOne } from "@/lib/db";
import { listIssues, type Issue } from "@/lib/ax";

/** 발행 호차 + 게재 원고 수 (articles.issue_id 기준) */
export interface PublishedIssue extends Issue {
  article_count: number;
}

export async function listPublishedIssues(): Promise<PublishedIssue[]> {
  const [issues, counts] = await Promise.all([
    listIssues("published"),
    query<{ issue_id: string; n: number }>(
      `SELECT issue_id, COUNT(*) AS n FROM articles WHERE issue_id IS NOT NULL GROUP BY issue_id`,
    ),
  ]);
  const byId = new Map(counts.map((c) => [c.issue_id, c.n]));
  return issues.map((i) => ({ ...i, article_count: byId.get(i.id) ?? 0 }));
}

export interface ArticleRow {
  id: string;
  part_no: number | null;
  chapter_no: number | null;
  part_title: string | null;
  section: string | null;
  subtitle: string | null;
  title: string | null;
  author_name: string | null;
  hall: string | null;
  class_name: string | null;
  university: string | null;
  epithet: string | null;
  char_count: number | null;
  source_type: string | null;
  source_order: number | null;
  qna_id: string | null;
  author_id: string;
}

export async function listArticlesByIssue(issueId: string): Promise<ArticleRow[]> {
  return query<ArticleRow>(
    `SELECT id, part_no, chapter_no, part_title, section, subtitle, title,
            author_name, hall, class_name, university, epithet, char_count,
            source_type, source_order, qna_id, author_id
     FROM articles
     WHERE issue_id = ?
     ORDER BY part_no, chapter_no, source_order`,
    [issueId],
  );
}

export interface ArticleDetail extends ArticleRow {
  issue_id: string | null;
  issue_label: string | null;
  final_content: string | null;
  comment: string | null;
  hanmadi: string | null;
  source_file: string | null;
  source_page: number | null;
  qna_ids_json: string | null;
}

export async function getArticle(id: string): Promise<ArticleDetail | null> {
  return queryOne<ArticleDetail>(
    `SELECT id, issue_id, issue_label, part_no, chapter_no, part_title, section, subtitle, title,
            author_name, hall, class_name, university, epithet, char_count,
            source_type, source_order, source_file, source_page, qna_id, author_id,
            final_content, comment, hanmadi, qna_ids_json
     FROM articles WHERE id = ?`,
    [id],
  );
}

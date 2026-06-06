// Core entity types. The DB-backed ones mirror the deployed D1 schema
// (see CLAUDE.md / migrations). PRD hierarchy types (Project/Issue/TocItem/
// Selection) back migration 0005 and are mostly read in the first pass.

export type StudentType = "성적우수" | "성적향상" | "포레스트" | "우선선발";

export type SubmissionStatus =
  | "received"
  | "reviewing"
  | "selected"
  | "rejected"
  | "archived";

export type ArticleStatus =
  | "draft"
  | "editing"
  | "review"
  | "final"
  | "published"
  | "archived";

export type EvaluatorType = "ai" | "manual";
export type AiSuspicionLevel = "low" | "medium" | "high";

export interface Author {
  id: string;
  name: string;
  cohort: number;
  student_type: StudentType | null;
  hall: string | null;
  class_name: string | null;
  admission_score: string | null;
  final_university: string | null;
  ai_evaluation_grade: string | null;
  manual_rating: string | null;
  memo: string | null;
  phone: string | null;
  sex: "남" | "여" | null;
  birthdate: string | null;
  korean_subject: string | null;
  math_subject: string | null;
  sci1_subject: string | null;
  sci2_subject: string | null;
}

export interface Submission {
  id: string;
  author_id: string;
  source_type: string | null;
  original_file_name: string | null;
  file_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
}

export interface Question {
  id: string;
  cohort: number;
  question_key: string | null;
  question_text: string;
  category: string | null;
  sort_order: number;
}

export interface QnaItem {
  question_id: string;
  question_text: string;
  category: string | null;
  sort_order: number;
  answer_text: string | null;
}

export interface Evaluation {
  id: string;
  author_id: string;
  submission_id: string | null;
  evaluator_type: EvaluatorType;
  total_score: number | null;
  specificity_score: number | null;
  authenticity_score: number | null;
  narrative_score: number | null;
  usefulness_score: number | null;
  ai_suspicion_level: AiSuspicionLevel | null;
  ai_suspicion_reason: string | null;
  evaluation_summary: string | null;
  evidence: string | null;
  scholarship_amount: number; // 최종 용역비 (원)
  created_at: string | null;
}

export interface Article {
  id: string;
  author_id: string;
  submission_id: string | null;
  title: string | null;
  draft_content: string | null;
  edited_content: string | null;
  final_content: string | null;
  article_status: ArticleStatus;
  editor_name: string | null;
  editor_note: string | null;
  updated_at: string | null;
}

// Joined view used by the 수기(Essay) 목록 screen — one row per author.
export interface EssayRow {
  id: string; // author id
  name: string;
  cohort: number;
  student_type: StudentType | null;
  final_university: string | null;
  ai_evaluation_grade: string | null;
  manual_rating: string | null;
  submission_status: SubmissionStatus | null;
  file_url: string | null;
  qna_count: number;
  total_score: number | null;
  specificity_score: number | null;
  authenticity_score: number | null;
  narrative_score: number | null;
  usefulness_score: number | null;
  ai_suspicion_level: AiSuspicionLevel | null;
  scholarship_amount: number | null;
}

// ---- PRD hierarchy (migration 0005) ----
export interface Project {
  id: string;
  name: string;
  year: number;
  status: "active" | "archived";
}

export interface Issue {
  id: string;
  project_id: string;
  issue_number: number | null;
  issue_label: string;
  status: "draft" | "in_progress" | "final" | "exported" | "archived";
}

export interface TocItem {
  id: string;
  issue_id: string;
  toc_order: number;
  toc_number: string | null;
  toc_title: string;
  toc_content: string | null;
  status: "draft" | "selecting" | "editing" | "final" | "exported";
}

export interface Selection {
  id: string;
  toc_id: string;
  author_id: string;
  submission_id: string | null;
  evaluation_id: string | null;
  selected_by_ai: 0 | 1;
  selected_by_user: 0 | 1;
  selection_reason: string | null;
}

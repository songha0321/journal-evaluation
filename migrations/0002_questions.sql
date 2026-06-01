-- 0002_questions.sql
-- Normalize question metadata out of qna into its own table.
-- Safe to run destructively because qna had 0 rows at the time of this migration.
-- If qna is non-empty when replaying, this WILL drop data — handle separately.

CREATE TABLE questions (
  id TEXT PRIMARY KEY DEFAULT ('question_' || lower(hex(randomblob(8)))),

  cohort INTEGER NOT NULL CHECK (cohort >= 5),

  question_key TEXT,          -- optional stable key for matching the "same question" across cohorts
  question_text TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_cohort       ON questions(cohort, sort_order);
CREATE INDEX idx_questions_question_key ON questions(question_key);

-- Rebuild qna with question_id FK; drop denormalized question_*/category/sort_order columns.
DROP TABLE qna;

CREATE TABLE qna (
  id TEXT PRIMARY KEY DEFAULT ('qna_' || lower(hex(randomblob(8)))),

  author_id     TEXT NOT NULL,
  submission_id TEXT,
  question_id   TEXT NOT NULL,

  answer_text   TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (author_id)     REFERENCES authors(id)     ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL,
  FOREIGN KEY (question_id)   REFERENCES questions(id)   ON DELETE RESTRICT
);

CREATE INDEX idx_qna_author      ON qna(author_id);
CREATE INDEX idx_qna_submission  ON qna(submission_id);
CREATE INDEX idx_qna_question    ON qna(question_id);

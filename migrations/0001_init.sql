-- 0001_init.sql
-- Snapshot of the schema deployed to `sdij-journal` D1 out-of-band on 2026-05-29.
-- Kept for replayability: re-running this on an empty D1 reproduces the original 6-table layout
-- (before the questions/qna normalization in 0002).

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY DEFAULT ('author_' || lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  cohort INTEGER CHECK (cohort >= 5),
  student_type TEXT CHECK (student_type IN ('성적우수', '성적향상', '포레스트')),
  hall TEXT,
  class_name TEXT,
  admission_score TEXT,
  final_university TEXT,
  ai_evaluation_grade TEXT,
  manual_rating TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY DEFAULT ('submission_' || lower(hex(randomblob(8)))),
  author_id TEXT NOT NULL,
  source_type TEXT DEFAULT 'form',
  raw_text TEXT,
  original_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'reviewing', 'selected', 'rejected', 'archived')
  ),
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qna (
  id TEXT PRIMARY KEY DEFAULT ('qna_' || lower(hex(randomblob(8)))),
  author_id TEXT NOT NULL,
  submission_id TEXT,
  question_key TEXT,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY DEFAULT ('evaluation_' || lower(hex(randomblob(8)))),
  author_id TEXT NOT NULL,
  submission_id TEXT,
  evaluator_type TEXT NOT NULL DEFAULT 'ai' CHECK (evaluator_type IN ('ai', 'manual')),
  total_score INTEGER CHECK (total_score BETWEEN 0 AND 100),
  specificity_score INTEGER CHECK (specificity_score BETWEEN 0 AND 10),
  authenticity_score INTEGER CHECK (authenticity_score BETWEEN 0 AND 10),
  narrative_score INTEGER CHECK (narrative_score BETWEEN 0 AND 10),
  usefulness_score INTEGER CHECK (usefulness_score BETWEEN 0 AND 10),
  ai_suspicion_level TEXT CHECK (ai_suspicion_level IN ('low', 'medium', 'high')),
  ai_suspicion_reason TEXT,
  evaluation_summary TEXT,
  evidence TEXT,
  scholarship_amount INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY DEFAULT ('article_' || lower(hex(randomblob(8)))),
  author_id TEXT NOT NULL,
  submission_id TEXT,
  title TEXT,
  draft_content TEXT,
  edited_content TEXT,
  final_content TEXT,
  article_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    article_status IN ('draft', 'editing', 'review', 'final', 'published', 'archived')
  ),
  editor_name TEXT,
  editor_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY DEFAULT ('log_' || lower(hex(randomblob(8)))),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  actor TEXT DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

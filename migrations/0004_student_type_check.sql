-- 0004_student_type_check.sql
-- Original CHECK only allowed ('성적우수','성적향상','포레스트'); '우선선발' is also a real
-- 시대인재N admission track and needs to be permitted. SQLite can't ALTER a CHECK in place,
-- so the table is rebuilt with the new constraint and rows are copied across.
--
-- FK references from submissions/qna/articles/evaluations point to authors(id) by table NAME,
-- so the DROP + RENAME below leaves them pointing at the rebuilt table once it has the same name.
-- foreign_keys is disabled around the swap to keep the engine from complaining about the
-- transient dangling reference between DROP and RENAME.

PRAGMA foreign_keys = OFF;

CREATE TABLE authors_new (
  id TEXT PRIMARY KEY DEFAULT ('author_' || lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  cohort INTEGER CHECK (cohort >= 5),
  student_type TEXT CHECK (
    student_type IN ('성적우수', '성적향상', '포레스트', '우선선발')
  ),
  hall TEXT,
  class_name TEXT,
  admission_score TEXT,
  final_university TEXT,
  ai_evaluation_grade TEXT,
  manual_rating TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  phone TEXT,
  sex TEXT CHECK (sex IN ('남', '여')),
  birthdate TEXT,
  korean_subject TEXT,
  math_subject TEXT,
  sci1_subject TEXT,
  sci2_subject TEXT
);

INSERT INTO authors_new SELECT * FROM authors;

DROP TABLE authors;

ALTER TABLE authors_new RENAME TO authors;

-- Backfill: the 33 rows already loaded came from the 우선선발 sheet.
UPDATE authors SET student_type = '우선선발' WHERE student_type IS NULL AND cohort = 9;

PRAGMA foreign_keys = ON;

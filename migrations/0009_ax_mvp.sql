-- AX MVP 상태 테이블: 목차(ax_toc) + 선별·편집 원고(ax_manuscript)
CREATE TABLE IF NOT EXISTS ax_toc (
  id TEXT PRIMARY KEY DEFAULT ('toc_' || lower(hex(randomblob(6)))),
  project TEXT NOT NULL DEFAULT '2027 항해일지',
  issue TEXT NOT NULL DEFAULT '1호차',
  part_no INTEGER,
  chapter_no INTEGER,
  title TEXT NOT NULL,
  toc_content TEXT,          -- 목차내용(편집자 작성, 선별 기준)
  hanmadi TEXT,              -- 한마디(편집자 작성, export 노출)
  cohort INTEGER,            -- 대상 기수
  select_count INTEGER DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ax_manuscript (
  id TEXT PRIMARY KEY DEFAULT ('ms_' || lower(hex(randomblob(6)))),
  toc_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  submission_id TEXT,
  subtitle TEXT,            -- 소제목(≤25자)
  comment TEXT,            -- 항해일지 comment
  edited_text TEXT,        -- 탈고문
  highlights_json TEXT,    -- 밑줄 구간 JSON
  status TEXT NOT NULL DEFAULT 'selected',  -- selected/edited/final
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(author_id)        -- 수기 중복 게재 금지(작성자당 1개 목차)
);

-- evaluations.is_selected (PRD 7.8.2): AI 선별 여부 명시 컬럼. total_score>=80(=4점)이면 선별.
ALTER TABLE evaluations ADD COLUMN is_selected INTEGER;
UPDATE evaluations SET is_selected = CASE WHEN total_score >= 80 THEN 1 ELSE 0 END;

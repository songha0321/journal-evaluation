-- 0005_projects_hierarchy.sql
-- PRD 위계: 연도(project) > 호차(issue) > 목차(toc_item) > 선별(selection).
-- 1차에서는 화면이 주로 기존 테이블(authors/qna/evaluations)을 읽고, 이 테이블들은
-- 위계/선별 영속화 도입(다음 차수) 대비용으로 미리 생성한다. 멱등(IF NOT EXISTS).
-- D1 규약: prefix_hex ID, CHECK enum, ISO TEXT 타임스탬프, BEGIN/COMMIT 없음, FK는 테이블명 참조.

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY DEFAULT ('project_' || lower(hex(randomblob(8)))),
  name        TEXT NOT NULL,                       -- 예: '2027 항해일지'
  year        INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issues (                -- 호차
  id            TEXT PRIMARY KEY DEFAULT ('issue_' || lower(hex(randomblob(8)))),
  project_id    TEXT NOT NULL,
  issue_number  INTEGER,                           -- 1,2,3 ; Final 은 NULL + label
  issue_label   TEXT NOT NULL,                     -- '1호차' / 'Final'
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','in_progress','final','exported','archived')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);

CREATE TABLE IF NOT EXISTS toc_items (             -- 목차
  id           TEXT PRIMARY KEY DEFAULT ('toc_' || lower(hex(randomblob(8)))),
  issue_id     TEXT NOT NULL,
  toc_order    INTEGER NOT NULL DEFAULT 0,         -- '2-1' 정렬용
  toc_number   TEXT,                               -- '2-1'
  toc_title    TEXT NOT NULL,                      -- '상반기 공부법'
  toc_content  TEXT,                               -- 목차 내용/설명
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','selecting','editing','final','exported')),
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_toc_issue ON toc_items(issue_id, toc_order);

CREATE TABLE IF NOT EXISTS selections (            -- 목차 ↔ 수기(author)
  id               TEXT PRIMARY KEY DEFAULT ('selection_' || lower(hex(randomblob(8)))),
  toc_id           TEXT NOT NULL,
  author_id        TEXT NOT NULL,                  -- Essay ≈ author
  submission_id    TEXT,
  evaluation_id    TEXT,                           -- 선별 근거 평가
  selected_by_ai   INTEGER NOT NULL DEFAULT 0 CHECK (selected_by_ai IN (0,1)),
  selected_by_user INTEGER NOT NULL DEFAULT 0 CHECK (selected_by_user IN (0,1)),
  selection_reason TEXT,
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (toc_id)        REFERENCES toc_items(id)   ON DELETE CASCADE,
  FOREIGN KEY (author_id)     REFERENCES authors(id)     ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_selections_toc    ON selections(toc_id);
CREATE INDEX IF NOT EXISTS idx_selections_author ON selections(author_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_selection_toc_author ON selections(toc_id, author_id);

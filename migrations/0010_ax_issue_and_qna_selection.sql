-- 0010: 호차(ax_issue) 신설 + 선별 단위를 author → qna 행으로 전환 + 진행 단계 컬럼
--
-- 근거: SELECTION.md §1(선별 단위 = qna 행), §2(중복 게재 3층 방어), PROCESS.md §5(단계 판정 컬럼)
-- 핵심 변경: ax_manuscript.UNIQUE(author_id) 제거 → UNIQUE(qna_id)
--   같은 작성자의 서로 다른 답변이 여러 목차에 실리는 것은 허용하고,
--   동일한 답변(내용)이 두 번 실리는 것만 차단한다.
--
-- D1 주의: BEGIN/COMMIT 사용 불가(문장별 autocommit). ALTER TABLE ADD COLUMN은 재실행 시
--   duplicate column 에러가 나므로 이 파일은 1회만 적용한다.

-- ─────────────────────────────────────────────────────────────
-- 1. 호차 (Project > Issue > Toc 위계, PRD 7.8.3)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ax_issue (
  id TEXT PRIMARY KEY DEFAULT ('issue_' || lower(hex(randomblob(6)))),
  project TEXT NOT NULL DEFAULT '2027 항해일지',
  issue_label TEXT NOT NULL,                 -- '1호차' · '2호차' · 'Final'
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'editing'
         CHECK (status IN ('editing','published','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ax_issue_project_label ON ax_issue(project, issue_label);

-- ─────────────────────────────────────────────────────────────
-- 2. 목차: 호차 연결 + 진행 단계(S1·S2·S6) 판정 컬럼
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ax_toc ADD COLUMN issue_id TEXT;                 -- FK → ax_issue(id)
ALTER TABLE ax_toc ADD COLUMN approved_question_ids TEXT;    -- S1: 승인 질문 id JSON 배열
ALTER TABLE ax_toc ADD COLUMN shortlisted_at TEXT;           -- S2: AI 수기 선별 완료 시각
ALTER TABLE ax_toc ADD COLUMN confirmed_at TEXT;             -- S3: 편집자 수기 확정 시각
ALTER TABLE ax_toc ADD COLUMN finalized_at TEXT;             -- S5: 원고 확정 시각
ALTER TABLE ax_toc ADD COLUMN exported_at TEXT;              -- S6: 원고 다운로드 시각

-- 기존 목차의 (project, issue) 조합으로 호차 행 생성 후 연결
INSERT OR IGNORE INTO ax_issue (project, issue_label)
  SELECT DISTINCT project, issue FROM ax_toc WHERE issue IS NOT NULL;

UPDATE ax_toc
   SET issue_id = (SELECT i.id FROM ax_issue i
                    WHERE i.project = ax_toc.project AND i.issue_label = ax_toc.issue)
 WHERE issue_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_ax_toc_issue ON ax_toc(issue_id);

-- ─────────────────────────────────────────────────────────────
-- 3. AI 선별 후보 (S2 산출물) — 편집자 확정 전 단계
--    SELECTION.md §3.3: 요청 개수 초과분도 버리지 않고 대기 상태로 보관한다.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ax_candidate (
  id TEXT PRIMARY KEY DEFAULT ('cand_' || lower(hex(randomblob(6)))),
  toc_id TEXT NOT NULL,
  qna_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  fit_score INTEGER,                 -- 목차 적합성 0~5
  confidence TEXT CHECK (confidence IN ('high','medium','low')),
  reason TEXT,                       -- AI 선별 이유 (신규 생성 정보)
  episode_json TEXT,                 -- SELECTION.md §2 L3 에피소드 지문 4요소
  content_hash TEXT,                 -- SELECTION.md §2 L2 정규화 해시
  rank INTEGER,                      -- 사용 적합 순위 (1이 최상)
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  duplicate_of TEXT,
  duplicate_warning INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(toc_id, qna_id)
);
CREATE INDEX IF NOT EXISTS ix_ax_candidate_toc_rank ON ax_candidate(toc_id, rank);

-- ─────────────────────────────────────────────────────────────
-- 4. ax_manuscript 재구축: UNIQUE(author_id) → UNIQUE(qna_id)
--    SQLite는 제약을 in-place로 바꿀 수 없으므로 테이블을 다시 만든다(0004 패턴).
--    기존 11행은 qna_id가 없으므로 NULL로 이관한다. SQLite UNIQUE는 다중 NULL을 허용하므로
--    레거시 행은 살아남고, 신규 행만 애플리케이션이 qna_id를 채운다.
-- ─────────────────────────────────────────────────────────────
PRAGMA foreign_keys = OFF;

CREATE TABLE ax_manuscript_new (
  id TEXT PRIMARY KEY DEFAULT ('ms_' || lower(hex(randomblob(6)))),
  toc_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  qna_id TEXT UNIQUE,                -- ★ 중복 게재 방지 L1. 신규 행은 필수, 레거시 행만 NULL
  submission_id TEXT,
  content_hash TEXT,                 -- ★ 중복 게재 방지 L2
  episode_json TEXT,                 -- ★ 중복 게재 방지 L3 (다음 선별의 입력으로 재사용)
  select_reason TEXT,                -- AI 선별 이유 (확정 시 ax_candidate에서 복사)
  subtitle TEXT,                     -- 소제목(≤25자)
  comment TEXT,                      -- 항해일지 comment
  edited_text TEXT,                  -- 탈고문
  revision_json TEXT,                -- 탈고 diff 항목별 사유·반영 여부
  highlights_json TEXT,              -- 밑줄 구간 JSON
  status TEXT NOT NULL DEFAULT 'confirmed'
         CHECK (status IN ('selected','confirmed','edited','final')),
  needs_review INTEGER NOT NULL DEFAULT 0,   -- 검수 필요(단계 아닌 경고 플래그)
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ax_manuscript_new
  (id, toc_id, author_id, qna_id, submission_id, content_hash, episode_json, select_reason,
   subtitle, comment, edited_text, revision_json, highlights_json, status,
   needs_review, review_note, created_at, updated_at)
SELECT
   id, toc_id, author_id, NULL, submission_id, NULL, NULL, NULL,
   subtitle, comment, edited_text, NULL, highlights_json,
   CASE WHEN status = 'selected' THEN 'confirmed' ELSE status END,
   0, NULL, created_at, updated_at
FROM ax_manuscript;

DROP TABLE ax_manuscript;
ALTER TABLE ax_manuscript_new RENAME TO ax_manuscript;

CREATE INDEX IF NOT EXISTS ix_ax_manuscript_toc ON ax_manuscript(toc_id);
CREATE INDEX IF NOT EXISTS ix_ax_manuscript_author ON ax_manuscript(author_id);
CREATE INDEX IF NOT EXISTS ix_ax_manuscript_hash ON ax_manuscript(content_hash);

PRAGMA foreign_keys = ON;

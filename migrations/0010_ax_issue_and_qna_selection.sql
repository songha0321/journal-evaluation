-- 0010: AX 워크플로우 테이블 전면 재구축 (호차 위계 + qna 단위 선별)
--
-- 근거: SELECTION.md §1(선별 단위 = qna 행), §2(중복 게재 3층 방어), PROCESS.md §3(원고 제작 6단계)
--
-- 핵심 변경: 선별 단위가 작성자 → qna 행으로 바뀐다.
--   기존 ax_manuscript.UNIQUE(author_id)는 "한 작성자는 한 목차에만" 이라는 뜻이라
--   요구사항(작성자 중복 허용 / 내용 중복 금지)과 정면 충돌한다. UNIQUE(qna_id)로 대체한다.
--
-- 기존 ax_* 데이터는 폐기 승인됨(2026-07-28). 마이그레이션이 아니라 재생성이므로
-- 레거시 이관 로직 없이 qna_id를 NOT NULL로 강제한다.
--
-- 영향 범위: ax_* 테이블만. authors / submissions / questions / qna / evaluations /
--   articles / activity_logs 는 건드리지 않는다.
--
-- D1 주의: BEGIN/COMMIT 사용 불가(문장별 autocommit).

DROP TABLE IF EXISTS ax_manuscript;
DROP TABLE IF EXISTS ax_candidate;
DROP TABLE IF EXISTS ax_toc;
DROP TABLE IF EXISTS ax_issue;

-- ─────────────────────────────────────────────────────────────
-- 1. 호차 — Project > Issue > Toc 위계 (PRD 7.8.3)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ax_issue (
  id TEXT PRIMARY KEY DEFAULT ('issue_' || lower(hex(randomblob(6)))),
  project TEXT NOT NULL DEFAULT '2027 항해일지',
  issue_label TEXT NOT NULL,                 -- '1호차' · '2호차' · 'Final'
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'editing'
         CHECK (status IN ('editing','published','archived')),
  cohort INTEGER,                            -- 선별 대상 기수
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  UNIQUE(project, issue_label)
);

-- ─────────────────────────────────────────────────────────────
-- 2. 목차 — 진행 단계(PROCESS.md 6단계) 판정 컬럼 포함
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ax_toc (
  id TEXT PRIMARY KEY DEFAULT ('toc_' || lower(hex(randomblob(6)))),
  issue_id TEXT NOT NULL,                    -- FK → ax_issue(id)
  part_no INTEGER,
  chapter_no INTEGER,
  title TEXT NOT NULL,
  toc_content TEXT,                          -- 목차내용(편집자 작성, 선별 기준)
  hanmadi TEXT,                              -- 한마디(편집자 작성, export 노출)
  select_count INTEGER NOT NULL DEFAULT 10,  -- 선별 개수
  -- 진행 단계 타임스탬프 (PROCESS.md §3.1)
  shortlisted_at TEXT,                       -- S2 AI 수기 선별 완료
  confirmed_at TEXT,                         -- S3 편집자 수기 확정
  finalized_at TEXT,                         -- S5 편집자 원고 확정
  exported_at TEXT,                          -- S6 원고 다운로드
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_ax_toc_issue ON ax_toc(issue_id, part_no, chapter_no);

-- ─────────────────────────────────────────────────────────────
-- 3. AI 선별 후보 (S2 산출물) — 편집자 확정 전 단계
--    SELECTION.md §3.3: 요청 개수 초과분도 버리지 않고 대기 상태로 보관한다.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ax_candidate (
  id TEXT PRIMARY KEY DEFAULT ('cand_' || lower(hex(randomblob(6)))),
  toc_id TEXT NOT NULL,
  qna_id TEXT NOT NULL,                      -- 선별 단위 = qna 행
  author_id TEXT NOT NULL,
  fit_score INTEGER,                         -- 목차 적합성 0~5
  confidence TEXT CHECK (confidence IN ('high','medium','low')),
  reason TEXT,                               -- AI 선별 이유 (신규 생성 정보)
  episode_json TEXT,                         -- SELECTION.md §2 L3 에피소드 지문 4요소
  content_hash TEXT,                         -- SELECTION.md §2 L2 정규화 해시
  rank INTEGER,                              -- 사용 적합 순위 (1이 최상)
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  duplicate_of TEXT,
  duplicate_warning INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(toc_id, qna_id)
);
CREATE INDEX ix_ax_candidate_toc_rank ON ax_candidate(toc_id, rank);

-- ─────────────────────────────────────────────────────────────
-- 4. 확정 원고 (S3 이후) — 중복 게재 방지의 본체
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ax_manuscript (
  id TEXT PRIMARY KEY DEFAULT ('ms_' || lower(hex(randomblob(6)))),
  toc_id TEXT NOT NULL,
  author_id TEXT NOT NULL,                   -- 중복 허용 (같은 학생의 다른 답변은 다른 목차에 실릴 수 있음)
  qna_id TEXT NOT NULL UNIQUE,               -- ★ L1: 동일 답변 재게재 원천 차단 (프로젝트 전체 범위)
  content_hash TEXT,                         -- ★ L2: 근사 중복 판정용 정규화 해시
  episode_json TEXT,                         -- ★ L3: 다음 선별의 중복 판정 입력으로 재사용
  select_reason TEXT,                        -- 확정 시 ax_candidate.reason 복사
  subtitle TEXT,                             -- 소제목(≤25자)
  comment TEXT,                              -- 항해일지 comment
  edited_text TEXT,                          -- 탈고문
  revision_json TEXT,                        -- 탈고 diff 항목별 사유·반영 여부
  highlights_json TEXT,                      -- 밑줄 구간 JSON
  status TEXT NOT NULL DEFAULT 'confirmed'
         CHECK (status IN ('confirmed','edited','final')),
  needs_review INTEGER NOT NULL DEFAULT 0,   -- 검수 필요(단계 아닌 경고 플래그)
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_ax_manuscript_toc ON ax_manuscript(toc_id);
CREATE INDEX ix_ax_manuscript_author ON ax_manuscript(author_id);
CREATE INDEX ix_ax_manuscript_hash ON ax_manuscript(content_hash);

-- ─────────────────────────────────────────────────────────────
-- 5. 초기 호차 1건 (편집 중 항해일지 화면의 시작점)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ax_issue (project, issue_label, sort_order, status, cohort)
VALUES ('2027 항해일지', '1호차', 1, 'editing', 9);

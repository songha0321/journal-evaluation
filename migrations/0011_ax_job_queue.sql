-- 0011: AI 작업 큐 — Workers는 요청만 적고, 로컬 러너가 가져가 처리한다.
--
-- 배경: 배포된 Cloudflare Worker는 V8 isolate라 child_process가 없어 CLI를 실행할 수 없다.
--   그래서 Worker는 '요청'만 D1에 기록하고, 맥에서 도는 러너(scripts/ax-runner.mjs)가
--   queued 항목을 가져가 LLM을 호출한 뒤 결과를 다시 D1에 적재한다.
--   덕분에 배포본은 그대로 유지되고, 편집자 동선(버튼 클릭 → 대기 → 알림)도 바뀌지 않는다.
--
-- 작업 종류는 두 가지이며 단위가 다르다.
--   shortlist : 목차 단위     → ax_toc
--   revise    : 원고 단위     → ax_manuscript
-- 지금은 shortlist만 쓰지만, GNB3 'AI 원고 탈고'도 같은 러너를 타므로 함께 만들어 둔다.
--
-- D1 주의: ALTER TABLE ADD COLUMN에 CHECK를 걸지 않는다(재실행·제약 변경이 모두 번거롭다).
--   상태값은 애플리케이션에서 강제한다: idle | queued | running | done | error

-- ── 목차 단위 작업: AI 수기 선별
ALTER TABLE ax_toc ADD COLUMN shortlist_status TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE ax_toc ADD COLUMN shortlist_requested_at TEXT;
ALTER TABLE ax_toc ADD COLUMN shortlist_started_at TEXT;
ALTER TABLE ax_toc ADD COLUMN shortlist_progress TEXT;   -- 예: '3/8 배치'
ALTER TABLE ax_toc ADD COLUMN shortlist_error TEXT;

CREATE INDEX ix_ax_toc_shortlist_queue ON ax_toc(shortlist_status, shortlist_requested_at);

-- ── 원고 단위 작업: AI 원고 탈고 (GNB3에서 사용)
ALTER TABLE ax_manuscript ADD COLUMN revise_status TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE ax_manuscript ADD COLUMN revise_requested_at TEXT;
ALTER TABLE ax_manuscript ADD COLUMN revise_error TEXT;

CREATE INDEX ix_ax_manuscript_revise_queue ON ax_manuscript(revise_status, revise_requested_at);

-- ── 러너 생존 신호
--   러너가 죽으면 큐에만 쌓이고 결과가 나오지 않는다. 대시보드에서 바로 보이도록
--   러너가 주기적으로 여기에 시각을 남긴다.
CREATE TABLE IF NOT EXISTS ax_runner (
  id TEXT PRIMARY KEY DEFAULT 'runner',
  last_seen_at TEXT,
  status TEXT,            -- idle | working
  note TEXT,              -- 현재 처리 중인 작업 설명
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO ax_runner (id, status) VALUES ('runner', 'idle');

-- 0014: 편집자 수기 확정자 기록 (S3). 확정 일시는 기존 confirmed_at.
ALTER TABLE ax_toc ADD COLUMN confirmed_by TEXT;

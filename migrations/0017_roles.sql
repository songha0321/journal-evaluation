-- 0017: 역할을 '관리자' / '편집자' 2종으로. 기존 운영관리자 → 관리자, 원고작업자·디자인검수자 → 편집자. 기본값 편집자.
-- SQLite는 CHECK를 바꿀 수 없어 테이블을 다시 만든다(0004 패턴).
CREATE TABLE IF NOT EXISTS app_users_new (
  id            TEXT PRIMARY KEY DEFAULT ('user_' || lower(hex(randomblob(8)))),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT '편집자' CHECK (role IN ('관리자', '편집자')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO app_users_new (id, email, name, role, is_active, last_login_at, created_at, updated_at)
SELECT id, email, name,
       CASE WHEN role = '운영관리자' OR role = '관리자' THEN '관리자' ELSE '편집자' END,
       is_active, last_login_at, created_at, updated_at
FROM app_users;
DROP TABLE app_users;
ALTER TABLE app_users_new RENAME TO app_users;

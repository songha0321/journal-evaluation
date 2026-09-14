-- 0013: 로그인 허가 계정 (FR-001). Google OIDC로 확인된 이메일이 여기 있어야 세션을 발급한다.
CREATE TABLE IF NOT EXISTS app_users (
  id            TEXT PRIMARY KEY DEFAULT ('user_' || lower(hex(randomblob(8)))),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT '원고작업자'
                CHECK (role IN ('원고작업자', '운영관리자', '디자인검수자')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_users (email, name, role)
SELECT 'apsongpark@gmail.com', '박송하', '운영관리자'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'apsongpark@gmail.com');

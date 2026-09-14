-- 0015: 원문-탈고문 비교 화면. 변경 항목별 댓글과 편집자가 고친 규칙 라벨.
-- edit_key = 변경 위치 키(before|after 해시 + 등장 순번). 비교는 매번 다시 계산하므로 본문이 바뀌면 키도 바뀐다.
CREATE TABLE IF NOT EXISTS ax_edit_comment (
  id           TEXT PRIMARY KEY DEFAULT ('ecm_' || lower(hex(randomblob(6)))),
  article_id   TEXT NOT NULL,
  edit_key     TEXT NOT NULL,
  author_email TEXT,
  author_name  TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_ax_edit_comment_article ON ax_edit_comment(article_id, edit_key);

CREATE TABLE IF NOT EXISTS ax_edit_label (
  article_id  TEXT NOT NULL,
  edit_key    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('typo','sensitive','term','structure','flow')),
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, edit_key)
);

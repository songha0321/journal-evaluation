-- 0006_authors_scholarship.sql
-- 장학금(용역비)을 authors 테이블로 통합.
-- 그동안 학생별 실지급 용역비는 evaluations.scholarship_amount 에 있었으나, 장학금은
-- 평가(리뷰) 단위가 아니라 학생(author) 단위 속성이므로 authors 로 옮긴다.
-- evaluations 가 작성자 1:1 로 정리된 뒤라 MAX 로 안전하게 끌어온다(과거 다중 평가행 방어).
-- D1 규약: 멱등 회피(ALTER ADD COLUMN 1회), ISO TEXT 타임스탬프, BEGIN/COMMIT 없음.

ALTER TABLE authors ADD COLUMN scholarship_amount INTEGER NOT NULL DEFAULT 0;

UPDATE authors
SET scholarship_amount = COALESCE(
  (SELECT MAX(e.scholarship_amount) FROM evaluations e WHERE e.author_id = authors.id),
  0
);

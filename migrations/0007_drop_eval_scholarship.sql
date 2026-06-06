-- 0007_drop_eval_scholarship.sql
-- 0006 에서 장학금을 authors.scholarship_amount 로 통합했고, FE 쿼리도 모두 authors 를
-- 읽도록 이전했다. evaluations.scholarship_amount 는 이제 중복/사장 컬럼이라 제거한다.
-- (백업: backups/evaluations_20260606_pre89.sql 에 컬럼 포함 상태가 남아 있음.)
-- D1/SQLite 3.35+ 는 ALTER TABLE DROP COLUMN 지원.

ALTER TABLE evaluations DROP COLUMN scholarship_amount;

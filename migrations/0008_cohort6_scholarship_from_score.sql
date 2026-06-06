-- 0008_cohort6_scholarship_from_score.sql
-- 6기 용역비(장학금) 적재.
-- 6기는 원본 스프레드시트에 용역비 탭이 없어 scholarship_amount 가 0 이었다(0006 백필 시 0).
-- 다만 6기는 평가 점수(evaluations.total_score)가 전원 채점돼 있으므로, "원래 기준"인
-- 성적우수 트랙 표준 대응(점수 ↔ 용역비)을 그대로 역으로 적용해 점수에서 용역비를 산출한다.
--
-- 성적우수 표준(8·9기 적재값에서 확인된 1:1 대응):
--   100 -> 250,000  /  80 -> 190,000  /  60 -> 150,000
--    40 -> 120,000  /  20 -> 100,000  /   0 -> 0
-- 6기 전원 성적우수. evaluations 는 작성자 1:1 이라 단일 점수로 매핑된다.
-- 결과: 6기 80명 / 13,070,000원 (0점 1명 제외). 멱등 — 재실행해도 같은 값.

UPDATE authors
SET scholarship_amount = COALESCE((
  SELECT CASE e.total_score
           WHEN 100 THEN 250000 WHEN 80 THEN 190000 WHEN 60 THEN 150000
           WHEN 40 THEN 120000  WHEN 20 THEN 100000 WHEN 0  THEN 0 END
  FROM evaluations e WHERE e.author_id = authors.id
), 0)
WHERE cohort = 6
  AND id IN (SELECT author_id FROM evaluations);

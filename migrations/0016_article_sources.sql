-- 0016: 게재 원고의 원문이 여러 답변일 수 있다. qna_id(대표) 외에 전체 목록을 JSON 배열로 둔다.
ALTER TABLE articles ADD COLUMN qna_ids_json TEXT;

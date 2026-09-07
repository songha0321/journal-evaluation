-- 0012: articles를 '게재 원고 정본'으로 확장.
--
-- 배경: articles에는 이미 402행(최종원고 docx 출처)이 있으나, 호차 정보도 재실행
--   안전장치도 출처 추적도 없다. title 한 컬럼에 Part·Chapter·소제목이 문자열로
--   뭉쳐 있어 어느 호차 게재분인지 기계가 판정할 수 없다.
--
-- 사용자 결정(2026-09-07):
--   - 2021·2022 항해일지(3·4기)는 적재하지 않는다 → author_id는 NOT NULL 유지.
--     (D1 authors는 5~9기만 존재. 3·4기를 넣으려면 껍데기 author가 필요해 기수 통계가 오염된다.)
--   - 텍스트가 아웃라인 처리된 인쇄본 PDF는 OCR 경로로 적재한다 → source_type='ocr'.
--
-- 설계:
--   - 기존 title은 건드리지 않는다. FE 쿼리 3곳(articles/essays/dashboard) 무손상.
--   - 구조화 필드를 옆에 추가하고, 적재 시 title도 함께 채운다.
--   - (source_file, source_order)에 UNIQUE 인덱스를 걸어 재적재를 멱등으로 만든다.
--     기존 402행은 source_file이 NULL이고 SQLite는 UNIQUE 인덱스에서 NULL을 서로
--     다른 값으로 보므로, 402행이 있어도 인덱스 생성이 통과한다.
--
-- D1 주의: BEGIN/COMMIT 불가(문장별 autocommit). ADD COLUMN은 재실행 시
--   duplicate column 에러 → 이 파일은 1회만 적용한다.

-- ── 게재 위치 (PROCESS.md의 Project > Issue > Toc 위계와 맞춘다)
ALTER TABLE articles ADD COLUMN issue_id TEXT;          -- ax_issue.id (역대 호차도 ax_issue에 등록)
ALTER TABLE articles ADD COLUMN issue_label TEXT;       -- '2027 항해일지 2호차' (비정규 백업)
ALTER TABLE articles ADD COLUMN part_no INTEGER;
ALTER TABLE articles ADD COLUMN chapter_no INTEGER;
ALTER TABLE articles ADD COLUMN part_title TEXT;        -- '좌절과 성취' (목차명만)
ALTER TABLE articles ADD COLUMN section TEXT;           -- '좌절 파트' 같은 구획
ALTER TABLE articles ADD COLUMN subtitle TEXT;          -- 소제목 / '[국어]' 과목 태그

-- ── 게재 원고 고유 정보 (수기 원본에는 없고 편집 결과로만 존재)
ALTER TABLE articles ADD COLUMN comment TEXT;           -- 항해일지팀 comment
ALTER TABLE articles ADD COLUMN hanmadi TEXT;           -- 목차 리드문(한마디)
ALTER TABLE articles ADD COLUMN focus_json TEXT;        -- 공부몰입도 12개월 시계열 JSON

-- ── 작성자 표기 (author_id 매칭과 별개로 지면에 인쇄된 원문을 보존)
ALTER TABLE articles ADD COLUMN author_name TEXT;       -- 지면 표기 이름
ALTER TABLE articles ADD COLUMN hall TEXT;              -- 'N관'
ALTER TABLE articles ADD COLUMN class_name TEXT;        -- 'S(2)반'
ALTER TABLE articles ADD COLUMN university TEXT;        -- '가톨릭대 의예과'
ALTER TABLE articles ADD COLUMN epithet TEXT;           -- '성적우수자' · '2026학년도 수능 수석'

-- ── 원본 추적 · 중복 판정
ALTER TABLE articles ADD COLUMN qna_id TEXT;            -- 원본 수기 답변(매칭되면). SELECTION.md L1
ALTER TABLE articles ADD COLUMN content_hash TEXT;      -- 정규화 본문 해시. SELECTION.md L2
ALTER TABLE articles ADD COLUMN source_file TEXT;       -- 원본 파일명
ALTER TABLE articles ADD COLUMN source_type TEXT;       -- 'docx' | 'pdf' | 'ocr'
ALTER TABLE articles ADD COLUMN source_page INTEGER;    -- PDF 페이지(pdf·ocr만)
ALTER TABLE articles ADD COLUMN source_order INTEGER;   -- 파일 내 꼭지 순번
ALTER TABLE articles ADD COLUMN char_count INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS ux_articles_source ON articles(source_file, source_order);
CREATE INDEX IF NOT EXISTS ix_articles_issue ON articles(issue_id, part_no, chapter_no, source_order);
CREATE INDEX IF NOT EXISTS ix_articles_hash  ON articles(content_hash);
CREATE INDEX IF NOT EXISTS ix_articles_qna   ON articles(qna_id);

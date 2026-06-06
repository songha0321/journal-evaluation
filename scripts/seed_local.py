# -*- coding: utf-8 -*-
"""로컬 D1(next dev/miniflare) 화면 확인용 합성 시드 생성. 실명/실 PII 없음.
실제 코호트 분포와 유사한 수치를 만들어 대시보드가 그럴듯하게 보이게 한다.
출력 SQL은 `npx wrangler d1 execute DB --local --file` 로 적용."""
import random

random.seed(7)
COHORTS = {5: 88, 6: 81, 7: 99, 8: 69, 9: 92}
TYPES = ["성적우수", "성적향상", "포레스트", "우선선발"]
UNIS = ["설의", "연의", "가의", "고의", "성의", "한양의", "중앙의", "경희의", "서울대", "연세대"]
FEES = [100000, 120000, 130000, 150000, 160000, 190000, 220000, 250000, 280000, 320000, 400000]
SUB_STATUS = ["received", "received", "received", "reviewing", "selected"]

out = ["PRAGMA foreign_keys = OFF;"]


def esc(s):
    return s.replace("'", "''")


qid = {}
for coh in COHORTS:
    for i in range(1, 6):  # 5 questions per cohort
        q = f"q_{coh}_{i}"
        qid[(coh, i)] = q
        out.append(
            f"INSERT INTO questions (id,cohort,question_key,question_text,category,sort_order) "
            f"VALUES ('{q}',{coh},'{coh}-{i}','문항 {coh}-{i} 내용','주제{i}',{i});"
        )

n = 0
for coh, cnt in COHORTS.items():
    for k in range(cnt):
        n += 1
        aid = f"a_{coh}_{k}"
        sid = f"s_{coh}_{k}"
        name = f"작성자{coh}{k:03d}"
        st = "성적우수" if coh == 6 else random.choice(TYPES)
        uni = random.choice(UNIS)
        fee = 0 if coh == 6 else random.choice(FEES)  # 장학금은 author 단위(0006). 6기는 자료 없음
        out.append(
            f"INSERT INTO authors (id,name,cohort,student_type,hall,class_name,final_university,sex,scholarship_amount) "
            f"VALUES ('{aid}','{name}',{coh},'{st}','W관','{random.choice('OST')}','{uni}','{random.choice(['남','여'])}',{fee});"
        )
        out.append(
            f"INSERT INTO submissions (id,author_id,source_type,original_file_name,status) "
            f"VALUES ('{sid}','{aid}','google_form','answer_{aid}.hwp','{random.choice(SUB_STATUS)}');"
        )
        for i in range(1, random.randint(3, 6)):
            out.append(
                f"INSERT INTO qna (id,author_id,submission_id,question_id,answer_text) "
                f"VALUES ('qa_{aid}_{i}','{aid}','{sid}','{qid[(coh,i)]}','답변 내용 예시 텍스트입니다.');"
            )
        # evaluations: 모든 코호트 manual 1건(8·9기는 2건). 장학금은 authors 로 이동(0006)
        n_ev = 2 if coh in (8, 9) else 1
        score = random.choice([20, 40, 60, 60, 80, 80, 100])
        susp = random.choice([None, None, None, "low", "medium", "high"])
        susp_sql = "NULL" if not susp else f"'{susp}'"
        sub2 = score // 20 * 2
        for e in range(n_ev):
            out.append(
                f"INSERT INTO evaluations (id,author_id,submission_id,evaluator_type,total_score,"
                f"specificity_score,authenticity_score,narrative_score,usefulness_score,"
                f"ai_suspicion_level,evaluation_summary,evidence) "
                f"VALUES ('e_{aid}_{e}','{aid}','{sid}','manual',{score},"
                f"{sub2},{sub2},{sub2},{sub2},{susp_sql},"
                f"'평가 요약 예시','평가자{random.randint(1,3)}');"
            )

out.append("PRAGMA foreign_keys = ON;")
open("/tmp/seed_local.sql", "w", encoding="utf-8").write("\n".join(out) + "\n")
print(f"authors={n}, stmts={len(out)} -> /tmp/seed_local.sql")

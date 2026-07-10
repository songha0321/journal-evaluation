"""
9기 성적향상(재종/기숙) 수기 → D1 ETL, **AI 평가(evaluator_type='ai') 포함**.

기존 `etl_sheet_to_d1.py`는 시트의 사람 평가(수기평1/2 = "점수/코멘트")를 읽어
`evaluations(evaluator_type='manual', total_score만)`을 적재한다. 성적향상자는 사람
평가가 없어, 대신 Claude가 EVALUATION.md 기준으로 평가한 결과를 별도 JSON으로 받아
`evaluator_type='ai'` + 4개 세부점수 + AI 의심도까지 채워 적재한다.

파이프라인:
  1) 원본 수기 탭(재종RAW / 기숙RAW)을 gviz CSV(이름 기반, gid 불필요)로 읽는다.
  2) `--evals eval.json` 에서 (tab, name) → 8개 평가필드를 읽는다.
  3) 학생을 (tab, 정규화된 이름)으로 조인.
  4) D1의 기존 questions/authors를 조회해 재사용(중복 방지). (etl_sheet_to_d1과 동일 로직)
  5) authors / submissions / qna / evaluations(ai) INSERT SQL 한 파일 생성.

평가필드 → D1 매핑 (EVALUATION.md D-2 / seed_local.py 스케일: sub=5점×2, total=5점×20):
  정성_구체성   → specificity_score  (×2, 0-10)
  독창성        → authenticity_score (×2, 0-10)   ※ 진정성 칸에 독창성을 매핑(남는 슬롯)
  가독성        → narrative_score    (×2, 0-10)
  실용성_타겟적합성 → usefulness_score (×2, 0-10)
  최종_점수     → total_score        (×20, 0-100)
  AI_사용도(0-5)→ ai_suspicion_level (0-1 low / 2-3 medium / 4-5 high)
  신뢰성_리스크 + AI 사유 → ai_suspicion_reason
  한줄평        → evaluation_summary
  evidence = 'AI (Claude)'

Usage:
  python3 etl_sugi_ai_eval.py --sheet-id <ID> \\
      --tab 재종RAW:재종 --tab 기숙RAW:기숙 \\
      --evals out/sugi_evals.json --out out/load_sugi.sql
  npx wrangler d1 execute DB --remote --file out/load_sugi.sql
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import urllib.parse
from pathlib import Path

import etl_sheet_to_d1 as base

STUDENT_TYPE = "성적향상"
COHORT = 9

# EVALUATION.md 필드 → (D1 컬럼, 세부점수 배수). 세부점수는 0-5 → 0-10 (×2).
SUBSCORE_MAP = {
    "specificity_score":  ("정성_구체성", 2),
    "authenticity_score": ("독창성", 2),
    "narrative_score":    ("가독성", 2),
    "usefulness_score":   ("실용성_타겟적합성", 2),
}


def ai_suspicion_level(ai_use) -> str | None:
    """AI_사용도(0-5) → low/medium/high 버킷."""
    try:
        v = int(ai_use)
    except (TypeError, ValueError):
        return None
    return "low" if v <= 1 else "medium" if v <= 3 else "high"


def fetch_gviz(sheet_id: str, sheet_name: str) -> list[list[str]]:
    """gviz CSV export by sheet NAME (gid 불필요). 링크공유(뷰어) 상태여야 함."""
    q = urllib.parse.quote(sheet_name)
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={q}"
    proc = subprocess.run(["curl", "-sSLf", url], check=True, capture_output=True, text=True)
    return list(csv.reader(proc.stdout.splitlines()))


def build_colmap(headers_norm: list[str], data: list[list[str]]) -> dict:
    fc = base.find_col
    return {
        "timestamp":  fc(headers_norm, "타임스탬프", optional=True),
        "name":       fc(headers_norm, "이름"),
        "phone":      fc(headers_norm, "전화번호", optional=True),
        "sex":        fc(headers_norm, "성별", optional=True),
        "birthdate":  fc(headers_norm, "생년월일", optional=True),
        "cohort_raw": fc(headers_norm, "재원 기수", "기수", optional=True),
        "hall":       fc(headers_norm, "관", exact=True, optional=True),
        "class":      fc(headers_norm, "반", exact=True, optional=True),
        "kor":        fc(headers_norm, "국어 선택과목", optional=True),
        "math":       fc(headers_norm, "수학 선택과목", optional=True),
        "sci1":       fc(headers_norm, "탐구 1선택", "탐구1", optional=True),
        "sci2":       fc(headers_norm, "탐구 2선택", "탐구2", optional=True),
        "file_url":   base.find_file_url_col(headers_norm, data),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet-id", required=True)
    ap.add_argument("--tab", action="append", required=True,
                    help="원본탭명:라벨 (예: 재종RAW:재종). 여러 번 지정 가능.")
    ap.add_argument("--evals", help="평가 JSON. 없으면 evaluations는 비우고 authors/qna만 적재.")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    # 평가 로드: {(tab_label, normalized_name): eval_dict}
    evals: dict[tuple[str, str], dict] = {}
    if args.evals:
        for e in json.load(open(args.evals, encoding="utf-8")):
            key = (e["tab"], base.normalize_name(e["name"]))
            evals[key] = e

    existing_by_text = base.fetch_existing_questions(COHORT)
    existing_by_name_phone, existing_by_name = base.fetch_existing_authors(COHORT, STUDENT_TYPE)

    questions_sql: list[str] = [f"-- questions (cohort {COHORT}, 성적향상) — new rows only"]
    per_row_sql: list[str] = []
    matched_existing_ids: list[str] = []
    n_updated = n_inserted = n_qna = n_evals = new_q = 0
    eval_used: set[tuple[str, str]] = set()

    for tab_spec in args.tab:
        tab_name, _, tab_label = tab_spec.partition(":")
        tab_label = tab_label or tab_name
        rows = fetch_gviz(args.sheet_id, tab_name)
        hdr_idx = base.detect_header_row(rows)
        headers_norm = [base.norm(h) for h in rows[hdr_idx]]
        data = rows[hdr_idx + 1:]
        col = build_colmap(headers_norm, data)
        question_cols = [(i, base.QUESTION_KEY_RE.match(h).group(1), h)
                         for i, h in enumerate(headers_norm) if base.QUESTION_KEY_RE.match(h)]
        print(f"[{tab_label}] {len(data)} rows, {len(question_cols)} question cols, "
              f"colmap={ {k: v for k, v in col.items() if v is not None} }", file=sys.stderr)

        # questions: INSERT new-by-text only
        qid_by_col: dict[int, str] = {}
        for col_idx, key, text in question_cols:
            qid = existing_by_text.get(text)
            if not qid:
                qid = base.new_id("question")
                questions_sql.append(
                    "INSERT INTO questions (id, cohort, question_key, question_text, category, sort_order) VALUES ("
                    f"{base.sql_str(qid)}, {COHORT}, {base.sql_str(key)}, {base.sql_str(text)}, "
                    f"{base.sql_str(base.section_category(key))}, {col_idx});"
                )
                existing_by_text[text] = qid
                new_q += 1
            qid_by_col[col_idx] = qid

        for row_idx, r in enumerate(data, start=hdr_idx + 1):
            def cell(key, default=""):
                i = col.get(key)
                if i is None or i >= len(r):
                    return default
                return (r[i] or "").strip()

            name = base.normalize_name(cell("name"))
            if not name:
                continue
            phone = cell("phone")
            existing_id = existing_by_name_phone.get((name, phone)) if phone else None
            if not existing_id:
                cands = existing_by_name.get(name, [])
                if len(cands) == 1:
                    existing_id = cands[0]
                elif len(cands) > 1:
                    print(f"warn: row {row_idx} '{name}' ambiguous ({len(cands)} DB rows) — inserting new.",
                          file=sys.stderr)
            author_id = existing_id or base.new_id("author")
            submission_id = base.new_id("submission")
            cohort = base.parse_cohort(cell("cohort_raw"), default=COHORT)
            birthdate = base.parse_birthdate(cell("birthdate"))

            per_row_sql.append(f"-- [{tab_label}] row {row_idx}: {name} ({'UPDATE' if existing_id else 'INSERT'})")
            if existing_id:
                per_row_sql.append(
                    "UPDATE authors SET "
                    f"name = {base.sql_str(name)}, cohort = {cohort}, student_type = {base.sql_str(STUDENT_TYPE)}, "
                    f"hall = {base.sql_str(cell('hall'))}, class_name = {base.sql_str(cell('class'))}, "
                    f"phone = {base.sql_str(cell('phone'))}, sex = {base.sql_str(cell('sex'))}, "
                    f"birthdate = {base.sql_str(birthdate)}, korean_subject = {base.sql_str(cell('kor'))}, "
                    f"math_subject = {base.sql_str(cell('math'))}, sci1_subject = {base.sql_str(cell('sci1'))}, "
                    f"sci2_subject = {base.sql_str(cell('sci2'))}, updated_at = CURRENT_TIMESTAMP "
                    f"WHERE id = {base.sql_str(existing_id)};"
                )
                matched_existing_ids.append(existing_id)
                n_updated += 1
            else:
                per_row_sql.append(
                    "INSERT INTO authors (id, name, cohort, student_type, hall, class_name, "
                    "phone, sex, birthdate, korean_subject, math_subject, sci1_subject, sci2_subject) VALUES ("
                    f"{base.sql_str(author_id)}, {base.sql_str(name)}, {cohort}, {base.sql_str(STUDENT_TYPE)}, "
                    f"{base.sql_str(cell('hall'))}, {base.sql_str(cell('class'))}, {base.sql_str(cell('phone'))}, "
                    f"{base.sql_str(cell('sex'))}, {base.sql_str(birthdate)}, {base.sql_str(cell('kor'))}, "
                    f"{base.sql_str(cell('math'))}, {base.sql_str(cell('sci1'))}, {base.sql_str(cell('sci2'))});"
                )
                n_inserted += 1

            per_row_sql.append(
                "INSERT INTO submissions (id, author_id, source_type, file_url, submitted_at) VALUES ("
                f"{base.sql_str(submission_id)}, {base.sql_str(author_id)}, 'google_form', "
                f"{base.sql_str(cell('file_url'))}, {base.sql_str(cell('timestamp'))});"
            )

            for col_idx, _, _ in question_cols:
                ans = (r[col_idx] or "").strip() if col_idx < len(r) else ""
                if not ans:
                    continue
                per_row_sql.append(
                    "INSERT INTO qna (id, author_id, submission_id, question_id, answer_text) VALUES ("
                    f"{base.sql_str(base.new_id('qna'))}, {base.sql_str(author_id)}, {base.sql_str(submission_id)}, "
                    f"{base.sql_str(qid_by_col[col_idx])}, {base.sql_str(ans)});"
                )
                n_qna += 1

            ev = evals.get((tab_label, name))
            if ev:
                eval_used.add((tab_label, name))
                subs = {c: (int(ev[src]) * mult if ev.get(src) not in (None, "") else None)
                        for c, (src, mult) in SUBSCORE_MAP.items()}
                total = int(ev["최종_점수"]) * 20 if ev.get("최종_점수") not in (None, "") else None
                level = ai_suspicion_level(ev.get("AI_사용도"))
                reason_bits = []
                if ev.get("신뢰성_리스크"):
                    reason_bits.append(f"신뢰성:{ev['신뢰성_리스크']}")
                if ev.get("AI_사용도_사유"):
                    reason_bits.append(ev["AI_사용도_사유"])
                reason = " / ".join(reason_bits) or None
                per_row_sql.append(
                    "INSERT INTO evaluations (id, author_id, submission_id, evaluator_type, total_score, "
                    "specificity_score, authenticity_score, narrative_score, usefulness_score, "
                    "ai_suspicion_level, ai_suspicion_reason, evaluation_summary, evidence) VALUES ("
                    f"{base.sql_str(base.new_id('evaluation'))}, {base.sql_str(author_id)}, {base.sql_str(submission_id)}, "
                    f"'ai', {base.sql_int(total)}, {base.sql_int(subs['specificity_score'])}, "
                    f"{base.sql_int(subs['authenticity_score'])}, {base.sql_int(subs['narrative_score'])}, "
                    f"{base.sql_int(subs['usefulness_score'])}, {base.sql_str(level)}, {base.sql_str(reason)}, "
                    f"{base.sql_str(ev.get('한줄평'))}, 'AI (Claude)');"
                )
                n_evals += 1
            per_row_sql.append("")

    # missing evals warning
    if args.evals:
        missing = [k for k in evals if k not in eval_used]
        if missing:
            print(f"warn: {len(missing)} eval entries did not match any sheet row: {missing}", file=sys.stderr)

    sql_out = [
        f"-- Generated by etl_sugi_ai_eval.py (student_type={STUDENT_TYPE}, cohort={COHORT})",
        f"-- UPDATE {n_updated} / INSERT {n_inserted} authors; qna={n_qna}; ai-evaluations={n_evals}; new questions={new_q}",
        "-- D1 rejects explicit BEGIN/COMMIT; each statement autocommits.",
        "",
    ]
    if matched_existing_ids:
        ids_sql = ", ".join(base.sql_str(i) for i in matched_existing_ids)
        sql_out += [
            f"-- Wipe sub-tables for {len(matched_existing_ids)} matched authors (re-run safety).",
            f"DELETE FROM qna         WHERE author_id IN ({ids_sql});",
            f"DELETE FROM evaluations WHERE author_id IN ({ids_sql});",
            f"DELETE FROM submissions WHERE author_id IN ({ids_sql});",
            "",
        ]
    sql_out += questions_sql + [""] + per_row_sql

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(sql_out) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}: UPDATE {n_updated} / INSERT {n_inserted} authors, "
          f"qna={n_qna}, ai-evaluations={n_evals}, new questions={new_q}", file=sys.stderr)


if __name__ == "__main__":
    main()

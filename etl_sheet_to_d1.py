"""
9기 수기 Google Sheet → D1 ETL.

Usage:
    python3 etl_sheet_to_d1.py \\
        --sheet-id 1Tra3_vaYocMM-7OJXMM4vrBTtEeCQxrUET1y4eIlV-g \\
        --student-type 우선선발 \\
        --out out/load_priority.sql

    npx wrangler d1 execute DB --remote --file out/load_priority.sql

Pipeline:
  1) curl the published sheet as CSV (no auth — sheet must be link-shared as viewer)
  2) detect the header row by looking for '이름' in row 0 or row 1
  3) build a column-by-header-name map (resilient to column reordering between sheets)
  4) query D1 for existing questions in this cohort and reuse their IDs by question_key
  5) emit one .sql file containing INSERTs for questions (new only) / authors / submissions / qna / evaluations

Notes:
  * IDs are minted client-side ('<prefix>_' + 16 hex chars) so FKs across statements line up.
  * 수기평 column format is "<score 0-5>/<comment>". total_score = score * 20.
  * Cohort is parsed from '재원 기수' value ("9기(2025), 8기(2024)" → 9).
  * 항해일지 분류 columns (col ~61+, '항해일지①' prefix) are intentionally ignored — separate concern.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import secrets
import subprocess
import sys
from pathlib import Path

ALLOWED_STUDENT_TYPES = {"성적우수", "성적향상", "포레스트", "우선선발"}
DRIVE_URL_RE = re.compile(r"https?://(?:drive|docs)\.google\.com/")
QUESTION_KEY_RE = re.compile(r"^\[(\d+-\d+)\]")
NAME_TRAILING_PARENS = re.compile(r"\s*\([^)]*\)\s*$")
NAME_TRAILING_LATIN  = re.compile(r"[A-Za-z]+$")


def normalize_name(raw: str) -> str:
    """Drop trailing 반/조 latin suffixes ('김동건B') and parenthetical comments
    ('김현일(자료를 잘못 보내…)'). Applied on every sheet ingest so that re-runs
    match the cleaned names in D1 instead of inserting duplicates."""
    n = (raw or "").strip()
    while True:
        before = n
        n = NAME_TRAILING_PARENS.sub("", n).strip()
        n = NAME_TRAILING_LATIN.sub("", n).strip()
        if n == before:
            return n


# ── helpers ───────────────────────────────────────────────────────────────────

def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def sql_str(v) -> str:
    if v is None:
        return "NULL"
    s = str(v)
    if not s.strip():
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def sql_int(v) -> str:
    if v is None or v == "":
        return "NULL"
    try:
        return str(int(v))
    except (TypeError, ValueError):
        return "NULL"


def norm(h: str) -> str:
    return h.replace("\n", " ").replace("\r", " ").strip()


def fetch_csv(sheet_id: str, gid: str = "") -> list[list[str]]:
    """Pull the sheet via curl. curl honors the system cert store; urllib on
    Python.org builds often can't verify Google's chain."""
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid:
        url += f"&gid={gid}"
    proc = subprocess.run(["curl", "-sSLf", url], check=True, capture_output=True, text=True)
    return list(csv.reader(proc.stdout.splitlines()))


def detect_header_row(rows: list[list[str]]) -> int:
    """Return the row index where '이름' appears as a header cell."""
    for i in (0, 1):
        if i >= len(rows):
            continue
        if any(norm(c) == "이름" for c in rows[i]):
            return i
    raise SystemExit("Could not find '이름' header in row 0 or 1.")


def find_col(headers_norm: list[str], *needles: str, optional: bool = False, exact: bool = False) -> int | None:
    """First column whose normalized header contains ANY of the needles.

    With ``exact=True`` the header must equal the needle exactly. Use this for
    short names like '관' / '반' that would otherwise match unrelated headers
    such as '관반' or '반수반?' as substrings.
    """
    for i, h in enumerate(headers_norm):
        for n in needles:
            if (h == n) if exact else (n in h):
                return i
    if optional:
        return None
    raise SystemExit(f"Header not found, tried: {needles}")


def find_file_url_col(headers_norm: list[str], data: list[list[str]]) -> int | None:
    """답안지(handwritten answer) file column. Priority:
      1. Header explicitly mentions '답안지'.
      2. Empty header with mostly-Drive-URL values (Forms file-upload pattern).
      3. Otherwise the *last* column that's mostly Drive URLs (other Drive cols
         may be timetable screenshots etc.; 답안지 tends to be near the end).
    """
    for i, h in enumerate(headers_norm):
        if "답안지" in h:
            return i
    n_cols = max((len(r) for r in data), default=0)
    def is_drive_col(c):
        vals = [r[c].strip() for r in data if c < len(r) and r[c].strip()]
        return vals and sum(1 for v in vals if DRIVE_URL_RE.match(v)) / len(vals) > 0.8
    # empty header + drive URLs
    for i, h in enumerate(headers_norm):
        if not h and is_drive_col(i):
            return i
    # last Drive URL column
    for i in range(n_cols - 1, -1, -1):
        if is_drive_col(i):
            return i
    return None


def parse_cohort(raw: str, default: int = 9) -> int:
    m = re.search(r"(\d+)\s*기", raw)
    return int(m.group(1)) if m else default


def parse_birthdate(raw: str) -> str | None:
    raw = (raw or "").strip()
    if re.fullmatch(r"\d{8}", raw):
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    return None


def parse_score_field(raw: str) -> tuple[int | None, str | None]:
    raw = (raw or "").strip()
    if not raw:
        return None, None
    head, sep, tail = raw.partition("/")
    head = head.strip()
    try:
        return int(head), (tail.strip() or None) if sep else None
    except ValueError:
        return None, raw


def fetch_existing_authors(cohort: int, student_type: str) -> tuple[dict[tuple[str, str], str], dict[str, list[str]]]:
    """Return two views of authors in the (cohort, student_type) slice:
      * by_name_phone — {(name, phone): id}, only for rows with a non-empty phone.
                       Used for unambiguous match against the form export.
      * by_name       — {name: [id, ...]}, the full set. Lets the caller detect
                       and warn about ambiguous name-only matches (homonyms).
    """
    st = student_type.replace("'", "''")
    proc = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "DB", "--remote", "--json",
            "--command",
            f"SELECT id, name, phone FROM authors WHERE cohort = {cohort} AND student_type = '{st}';",
        ],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print(f"warn: could not query existing authors ({proc.returncode}); assuming none.", file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        return {}, {}
    start = proc.stdout.find("[")
    if start < 0:
        return {}, {}
    try:
        payload = json.loads(proc.stdout[start:])
    except json.JSONDecodeError:
        return {}, {}
    by_name_phone: dict[tuple[str, str], str] = {}
    by_name: dict[str, list[str]] = {}
    for batch in payload:
        for row in batch.get("results", []):
            name = row.get("name") or ""
            phone = (row.get("phone") or "").strip()
            aid = row.get("id")
            if not (name and aid):
                continue
            if phone:
                by_name_phone[(name, phone)] = aid
            by_name.setdefault(name, []).append(aid)
    return by_name_phone, by_name


def fetch_existing_questions(cohort: int) -> dict[str, str]:
    """Return {question_text: question_id} already in D1 for this cohort.

    Match by full text rather than question_key: keys like '3-1' / '7-1' repeat across
    multiple columns (전체 vs 종류별 vs 이유) and would collide if used as the dedup key.
    """
    proc = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "DB", "--remote", "--json",
            "--command", f"SELECT id, question_text FROM questions WHERE cohort = {cohort};",
        ],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print(f"warn: could not query existing questions ({proc.returncode}); assuming none.", file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        return {}
    start = proc.stdout.find("[")
    if start < 0:
        return {}
    try:
        payload = json.loads(proc.stdout[start:])
    except json.JSONDecodeError:
        return {}
    out: dict[str, str] = {}
    for batch in payload:
        for row in batch.get("results", []):
            text = row.get("question_text")
            qid = row.get("id")
            if text and qid:
                out[text] = qid
    return out


def section_category(question_key: str) -> str:
    return f"section_{question_key.split('-')[0]}"


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet-id", required=True)
    ap.add_argument("--gid", default="")
    ap.add_argument("--student-type", required=True, choices=sorted(ALLOWED_STUDENT_TYPES))
    ap.add_argument("--cohort", type=int, default=9)
    ap.add_argument("--out", required=True, help="path to write the generated .sql file")
    args = ap.parse_args()

    rows = fetch_csv(args.sheet_id, args.gid)
    header_row_idx = detect_header_row(rows)
    headers_raw = rows[header_row_idx]
    headers_norm = [norm(h) for h in headers_raw]
    data = rows[header_row_idx + 1:]
    print(f"Sheet {args.sheet_id} (gid={args.gid or '<default>'}): header at row {header_row_idx}, {len(data)} data rows, {len(headers_norm)} cols.", file=sys.stderr)

    # Each form generation reorders / renames columns; alternate spellings keep one script for all.
    # 7기 only has one reviewer (`수기평` / `평가자` / `비고` — singular). 8기/9기 have two.
    score_1 = find_col(headers_norm, "수기평1", "평가1", "수기평")
    score_2 = find_col(headers_norm, "수기평2", "평가2", optional=True)
    single_reviewer = score_2 is None

    if single_reviewer:
        # 7기-style: `평가자` (no digit) sits separately from `수기평`; needle-only match is safe
        # because no second-reviewer column exists to confuse it.
        reviewer_1 = find_col(headers_norm, "평가자1", "평가자", optional=True)
        reviewer_2 = None
        note_1 = find_col(headers_norm, "비고_평가자1", "비고 평가자1", "비고1", "비고", optional=True)
        note_2 = None
    else:
        # 8기/9기-style: reviewer columns sometimes get overwritten (e.g. 8기 성적우수's col 0
        # was relabeled "거센 파도를 지나며"). Positional fallback: reviewer name columns are
        # always the two slots immediately before the score columns.
        reviewer_1 = find_col(headers_norm, "평가자1", optional=True)
        if reviewer_1 is None and score_1 - 2 >= 0:
            reviewer_1 = score_1 - 2
        reviewer_2 = find_col(headers_norm, "평가자2", optional=True)
        if reviewer_2 is None and score_1 - 1 >= 0:
            reviewer_2 = score_1 - 1
        note_1 = find_col(headers_norm, "비고_평가자1", "비고 평가자1", "비고1", optional=True)
        note_2 = find_col(headers_norm, "비고_평가자2", "비고 평가자2", "비고2", optional=True)

    col = {
        "timestamp":  find_col(headers_norm, "타임스탬프", optional=True),
        "reviewer_1": reviewer_1,
        "reviewer_2": reviewer_2,
        "score_1":    score_1,
        "score_2":    score_2,
        "note_1":     note_1,
        "note_2":     note_2,
        "name":       find_col(headers_norm, "이름"),
        "phone":      find_col(headers_norm, "전화번호", optional=True),
        "sex":        find_col(headers_norm, "성별", optional=True),
        "birthdate":  find_col(headers_norm, "생년월일", optional=True),
        # "재원 기수" preferred; "기수" is the 8기 form's spelling (also matches "재원 기수" by substring).
        "cohort_raw": find_col(headers_norm, "재원 기수", "기수", optional=True),
        # Exact match: '관' / '반' would otherwise also catch '관반' (7기 col 13) and '반수반?' (col 12).
        "hall":       find_col(headers_norm, "관", exact=True),
        "class":      find_col(headers_norm, "반", exact=True),
        "kor":        find_col(headers_norm, "국어 선택과목", optional=True),
        "math":       find_col(headers_norm, "수학 선택과목", optional=True),
        # 9기 spells the subject columns "탐구 1선택"; 8기 uses bare "탐구1".
        "sci1":       find_col(headers_norm, "탐구 1선택", "탐구1", optional=True),
        "sci2":       find_col(headers_norm, "탐구 2선택", "탐구2", optional=True),
        # 7기 form carries 최종대학 (graduated alumni); we seed it on INSERT but never on UPDATE
        # so admin edits stay authoritative for current students.
        "final_univ": find_col(headers_norm, "최종대학", optional=True),
        "file_url":   find_file_url_col(headers_norm, data),
    }
    print("Column map:", {k: v for k, v in col.items() if v is not None}, file=sys.stderr)

    # Question columns: any header that begins with [N-M].
    question_cols: list[tuple[int, str, str]] = []
    for i, h in enumerate(headers_norm):
        m = QUESTION_KEY_RE.match(h)
        if m:
            question_cols.append((i, m.group(1), h))
    print(f"Question columns: {len(question_cols)}", file=sys.stderr)

    existing_by_text = fetch_existing_questions(args.cohort)
    existing_by_name_phone, existing_by_name = fetch_existing_authors(args.cohort, args.student_type)
    n_existing = sum(len(v) for v in existing_by_name.values())
    print(
        f"Found {len(existing_by_text)} existing questions and "
        f"{n_existing} existing authors in {args.student_type} cohort {args.cohort}.",
        file=sys.stderr,
    )

    # questions — INSERT only the ones that don't already exist for this cohort
    question_id_by_col: dict[int, str] = {}
    questions_sql: list[str] = [f"-- questions (cohort {args.cohort}) — new rows only"]
    new_q = 0
    for col_idx, key, text in question_cols:
        qid = existing_by_text.get(text)
        if not qid:
            qid = new_id("question")
            questions_sql.append(
                "INSERT INTO questions (id, cohort, question_key, question_text, category, sort_order) VALUES ("
                f"{sql_str(qid)}, {args.cohort}, {sql_str(key)}, {sql_str(text)}, "
                f"{sql_str(section_category(key))}, {col_idx});"
            )
            existing_by_text[text] = qid
            new_q += 1
        question_id_by_col[col_idx] = qid

    # Phase 1: walk the sheet, decide UPDATE vs INSERT per author, emit per-row statements.
    matched_existing_ids: list[str] = []
    per_row_sql: list[str] = []
    n_updated = n_inserted = n_qna = n_evals = 0
    for row_idx, r in enumerate(data, start=header_row_idx + 1):
        def cell(key, default=""):
            i = col.get(key)
            if i is None or i >= len(r):
                return default
            return r[i].strip() if r[i] is not None else default

        name = normalize_name(cell("name"))
        if not name:
            continue
        phone = cell("phone")

        # Matching priority: (name, phone) → name when only one DB row has that name.
        # If multiple DB rows share the name and phone disagrees, we can't safely
        # pick one — treat the sheet row as a new author and warn.
        existing_id = existing_by_name_phone.get((name, phone)) if phone else None
        if not existing_id:
            candidates = existing_by_name.get(name, [])
            if len(candidates) == 1:
                existing_id = candidates[0]
            elif len(candidates) > 1:
                print(
                    f"warn: row {row_idx} '{name}' has {len(candidates)} DB rows with that name "
                    f"and no (name, phone) match — inserting as a new author.",
                    file=sys.stderr,
                )
        author_id = existing_id or new_id("author")
        submission_id = new_id("submission")
        cohort = parse_cohort(cell("cohort_raw"), default=args.cohort)
        birthdate = parse_birthdate(cell("birthdate"))

        per_row_sql.append(f"-- row {row_idx}: {name} ({'UPDATE' if existing_id else 'INSERT'})")
        if existing_id:
            # Update only form-sourced fields; leave admin-edited fields
            # (admission_score, ai_evaluation_grade, manual_rating, memo) alone.
            # final_university uses COALESCE+NULLIF so a sheet value (e.g. 7기 alumni's 최종대학)
            # overwrites a NULL DB row, but an empty sheet cell never wipes an admin entry.
            per_row_sql.append(
                "UPDATE authors SET "
                f"name = {sql_str(name)}, "
                f"cohort = {cohort}, "
                f"student_type = {sql_str(args.student_type)}, "
                f"hall = {sql_str(cell('hall'))}, "
                f"class_name = {sql_str(cell('class'))}, "
                f"phone = {sql_str(cell('phone'))}, "
                f"sex = {sql_str(cell('sex'))}, "
                f"birthdate = {sql_str(birthdate)}, "
                f"korean_subject = {sql_str(cell('kor'))}, "
                f"math_subject = {sql_str(cell('math'))}, "
                f"sci1_subject = {sql_str(cell('sci1'))}, "
                f"sci2_subject = {sql_str(cell('sci2'))}, "
                f"final_university = COALESCE(NULLIF({sql_str(cell('final_univ'))}, ''), final_university), "
                "updated_at = CURRENT_TIMESTAMP "
                f"WHERE id = {sql_str(existing_id)};"
            )
            matched_existing_ids.append(existing_id)
            n_updated += 1
        else:
            per_row_sql.append(
                "INSERT INTO authors ("
                "id, name, cohort, student_type, hall, class_name, "
                "phone, sex, birthdate, korean_subject, math_subject, sci1_subject, sci2_subject, "
                "final_university"
                ") VALUES ("
                f"{sql_str(author_id)}, {sql_str(name)}, {cohort}, {sql_str(args.student_type)}, "
                f"{sql_str(cell('hall'))}, {sql_str(cell('class'))}, "
                f"{sql_str(cell('phone'))}, {sql_str(cell('sex'))}, {sql_str(birthdate)}, "
                f"{sql_str(cell('kor'))}, {sql_str(cell('math'))}, "
                f"{sql_str(cell('sci1'))}, {sql_str(cell('sci2'))}, "
                f"{sql_str(cell('final_univ'))}"
                ");"
            )
            n_inserted += 1

        per_row_sql.append(
            "INSERT INTO submissions ("
            "id, author_id, source_type, file_url, submitted_at"
            ") VALUES ("
            f"{sql_str(submission_id)}, {sql_str(author_id)}, 'google_form', "
            f"{sql_str(cell('file_url'))}, {sql_str(cell('timestamp'))}"
            ");"
        )

        for col_idx, _, _ in question_cols:
            ans = r[col_idx].strip() if col_idx < len(r) and r[col_idx] else ""
            if not ans:
                continue
            per_row_sql.append(
                "INSERT INTO qna (id, author_id, submission_id, question_id, answer_text) VALUES ("
                f"{sql_str(new_id('qna'))}, {sql_str(author_id)}, {sql_str(submission_id)}, "
                f"{sql_str(question_id_by_col[col_idx])}, {sql_str(ans)}"
                ");"
            )
            n_qna += 1

        for reviewer_key, score_key, note_key in [
            ("reviewer_1", "score_1", "note_1"),
            ("reviewer_2", "score_2", "note_2"),
        ]:
            reviewer = cell(reviewer_key)
            score, comment = parse_score_field(cell(score_key))
            note = cell(note_key)
            if score is None and not reviewer and not note:
                continue
            total = score * 20 if score is not None else None
            summary = " / ".join(p for p in (comment, note) if p) or None
            per_row_sql.append(
                "INSERT INTO evaluations ("
                "id, author_id, submission_id, evaluator_type, total_score, evaluation_summary, evidence"
                ") VALUES ("
                f"{sql_str(new_id('evaluation'))}, {sql_str(author_id)}, {sql_str(submission_id)}, "
                f"'manual', {sql_int(total)}, {sql_str(summary)}, {sql_str(reviewer or None)}"
                ");"
            )
            n_evals += 1

        per_row_sql.append("")

    # Phase 2: assemble the file. DELETEs for matched authors first so their old
    # submissions/qna/evaluations don't accumulate on re-runs. Authors absent
    # from the sheet are untouched.
    sql_out: list[str] = [
        f"-- Generated by etl_sheet_to_d1.py for sheet {args.sheet_id}",
        f"-- student_type={args.student_type}, cohort={args.cohort}",
        f"-- UPDATE {n_updated} existing authors, INSERT {n_inserted} new authors",
        "-- D1 rejects explicit BEGIN/COMMIT; each statement runs autocommit.",
        "",
    ]
    if matched_existing_ids:
        ids_sql = ", ".join(sql_str(i) for i in matched_existing_ids)
        sql_out += [
            f"-- Wipe sub-tables for the {len(matched_existing_ids)} matched authors "
            "(admin-edited fields on authors stay because authors are UPDATEd, not DELETEd).",
            f"DELETE FROM qna         WHERE author_id IN ({ids_sql});",
            f"DELETE FROM evaluations WHERE author_id IN ({ids_sql});",
            f"DELETE FROM submissions WHERE author_id IN ({ids_sql});",
            "",
        ]
    sql_out += questions_sql + [""] + per_row_sql

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(sql_out) + "\n", encoding="utf-8")
    print(
        f"Wrote {out_path}: UPDATE {n_updated} / INSERT {n_inserted} authors, "
        f"qna={n_qna}, evaluations={n_evals}, new questions={new_q}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()

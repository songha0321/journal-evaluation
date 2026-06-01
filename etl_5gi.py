"""
5기 수기 Google Sheet → D1 ETL.

The 5기 form is a stripped-down variant: name + 답안지 Drive URL + final 대학 +
self-classification tag only. No per-question text answers, no reviewer scores.
Only `authors` and `submissions` are touched; `questions`, `qna`, `evaluations`
are left empty for this cohort.

Idempotency key is `submissions.file_url` (every upload gets a fresh Drive ID,
so the URL is a stable natural key for re-runs). On rerun:
  * URL already in D1     → UPDATE that author + submission with current sheet values
  * URL not yet in D1     → INSERT new author + submission
Authors-by-name matching is intentionally NOT used here because 5기 has homonyms
and no phone number for tie-breaking; the file URL avoids that ambiguity.

Usage:
    python3 etl_5gi.py \\
        --sheet-id 1bnNHm_lI7cZlFZ6fhE5NUBHiWhwwDG6TYY7mx70-1p0 \\
        --student-type 포레스트 \\
        --out out/load_5gi_forest.sql

    npx wrangler d1 execute DB --remote --file out/load_5gi_forest.sql
"""
from __future__ import annotations

import argparse
import csv
import json
import secrets
import subprocess
import sys
from pathlib import Path

import re as _re

COHORT = 5
ALLOWED_STUDENT_TYPES = {"성적우수", "성적향상", "포레스트", "우선선발"}

_NAME_TRAILING_PARENS = _re.compile(r"\s*\([^)]*\)\s*$")
_NAME_TRAILING_LATIN  = _re.compile(r"[A-Za-z]+$")


def normalize_name(raw: str) -> str:
    """Same rule as etl_sheet_to_d1.normalize_name — strip trailing 반/조 letters
    and parenthetical comments so re-runs match the cleaned names in D1."""
    n = (raw or "").strip()
    while True:
        before = n
        n = _NAME_TRAILING_PARENS.sub("", n).strip()
        n = _NAME_TRAILING_LATIN.sub("", n).strip()
        if n == before:
            return n


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def sql_str(v) -> str:
    if v is None:
        return "NULL"
    s = str(v)
    if not s.strip():
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def norm(h: str) -> str:
    return h.replace("\n", " ").replace("\r", " ").strip()


def fetch_csv(sheet_id: str) -> list[list[str]]:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    proc = subprocess.run(["curl", "-sSLf", url], check=True, capture_output=True, text=True)
    return list(csv.reader(proc.stdout.splitlines()))


def find_col(headers: list[str], *needles: str, optional: bool = False) -> int | None:
    for i, h in enumerate(headers):
        for n in needles:
            if n in h:
                return i
    if optional:
        return None
    raise SystemExit(f"Header not found, tried: {needles}")


def fetch_existing_by_file_url(student_type: str) -> dict[str, tuple[str, str]]:
    """Return {file_url: (author_id, submission_id)} for the 5기 slice of this student_type."""
    st = student_type.replace("'", "''")
    proc = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "DB", "--remote", "--json",
            "--command",
            "SELECT s.id AS sid, s.author_id AS aid, s.file_url AS file_url "
            "FROM submissions s JOIN authors a ON a.id = s.author_id "
            f"WHERE a.cohort = {COHORT} AND a.student_type = '{st}' AND s.file_url IS NOT NULL;",
        ],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print(f"warn: could not query existing 5기 submissions ({proc.returncode}); assuming none.", file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        return {}
    start = proc.stdout.find("[")
    if start < 0:
        return {}
    try:
        payload = json.loads(proc.stdout[start:])
    except json.JSONDecodeError:
        return {}
    out: dict[str, tuple[str, str]] = {}
    for batch in payload:
        for row in batch.get("results", []):
            url = row.get("file_url")
            if url:
                out[url] = (row.get("aid"), row.get("sid"))
    return out


def build_memo(soshok: str, self_classification: str) -> str | None:
    parts = []
    if soshok:
        parts.append(f"소속: {soshok}")
    if self_classification:
        parts.append(f"자가분류: {self_classification}")
    return " / ".join(parts) if parts else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet-id", required=True)
    ap.add_argument("--student-type", required=True, choices=sorted(ALLOWED_STUDENT_TYPES))
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--require-self-class", default=None,
        help="Only load rows whose col-4 self-classification value contains this substring. "
             "Used to split a mixed sheet (e.g. 5기 사전 분리) across multiple student_type runs.",
    )
    ap.add_argument(
        "--exclude-self-class", default=None,
        help="Skip rows whose col-4 self-classification value contains this substring. "
             "Complement of --require-self-class for the same split.",
    )
    args = ap.parse_args()

    rows = fetch_csv(args.sheet_id)
    headers = [norm(h) for h in rows[0]]
    data = rows[1:]
    print(f"Sheet {args.sheet_id}: {len(data)} data rows, {len(headers)} cols.", file=sys.stderr)

    col = {
        "timestamp":   find_col(headers, "타임스탬프", optional=True),
        "name":        find_col(headers, "이름"),
        "soshok":      find_col(headers, "소속", optional=True),
        "final_univ":  find_col(headers, "최종 진학 대학", "최종대학", optional=True),
        "self_class":  find_col(headers, "다음 중 해당하시는 것", "체크해주세요", optional=True),
        "file_url":    find_col(headers, "수기 파일", "답안지", optional=True),
    }
    print("Column map:", {k: v for k, v in col.items() if v is not None}, file=sys.stderr)

    existing = fetch_existing_by_file_url(args.student_type)
    print(f"Found {len(existing)} existing 5기 {args.student_type} submissions in D1.", file=sys.stderr)

    sql: list[str] = [
        f"-- Generated by etl_5gi.py for sheet {args.sheet_id}",
        f"-- student_type={args.student_type}, cohort=5",
        "-- D1 rejects explicit BEGIN/COMMIT; each statement runs autocommit.",
        "",
    ]

    n_updated = n_inserted = 0
    seen_urls: set[str] = set()
    for row_idx, r in enumerate(data, start=2):
        def cell(key, default=""):
            i = col.get(key)
            if i is None or i >= len(r):
                return default
            return r[i].strip() if r[i] is not None else default

        name = normalize_name(cell("name"))
        file_url = cell("file_url")
        if not name and not file_url:
            continue
        if file_url and file_url in seen_urls:
            print(f"warn: duplicate file_url within sheet at row {row_idx}; skipping.", file=sys.stderr)
            continue

        timestamp = cell("timestamp")
        final_univ = cell("final_univ")
        soshok = cell("soshok")
        self_class = cell("self_class")

        if args.require_self_class and args.require_self_class not in self_class:
            continue
        if args.exclude_self_class and args.exclude_self_class in self_class:
            continue

        if file_url:
            seen_urls.add(file_url)
        memo = build_memo(soshok, self_class)

        existing_ids = existing.get(file_url) if file_url else None
        if existing_ids:
            author_id, submission_id = existing_ids
            sql.append(f"-- row {row_idx}: {name} (UPDATE by file_url)")
            # 5기 is a graduated cohort, so the sheet's 최종 진학 대학 value is authoritative
            # whenever the cell is non-empty. The COALESCE+NULLIF guard prevents an empty sheet
            # cell from clobbering an admin-resolved final_university that someone added later.
            sql.append(
                "UPDATE authors SET "
                f"name = {sql_str(name)}, "
                f"final_university = COALESCE(NULLIF({sql_str(final_univ)}, ''), final_university), "
                "updated_at = CURRENT_TIMESTAMP "
                f"WHERE id = {sql_str(author_id)};"
            )
            sql.append(
                "UPDATE submissions SET "
                f"submitted_at = {sql_str(timestamp)}, "
                "updated_at = CURRENT_TIMESTAMP "
                f"WHERE id = {sql_str(submission_id)};"
            )
            n_updated += 1
        else:
            author_id = new_id("author")
            submission_id = new_id("submission")
            sql.append(f"-- row {row_idx}: {name} (INSERT)")
            sql.append(
                "INSERT INTO authors ("
                "id, name, cohort, student_type, memo, final_university"
                ") VALUES ("
                f"{sql_str(author_id)}, {sql_str(name)}, {COHORT}, {sql_str(args.student_type)}, "
                f"{sql_str(memo)}, {sql_str(final_univ)}"
                ");"
            )
            sql.append(
                "INSERT INTO submissions ("
                "id, author_id, source_type, file_url, submitted_at"
                ") VALUES ("
                f"{sql_str(submission_id)}, {sql_str(author_id)}, 'google_form', "
                f"{sql_str(file_url)}, {sql_str(timestamp)}"
                ");"
            )
            n_inserted += 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(sql) + "\n", encoding="utf-8")
    print(
        f"Wrote {out_path}: UPDATE {n_updated} / INSERT {n_inserted} authors",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()

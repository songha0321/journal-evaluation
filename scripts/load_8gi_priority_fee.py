#!/usr/bin/env python3
"""One-off: load 8기 우선선발 용역비 (scholarship_amount) into authors.

Source: sheet 1413Y5B6… tab '용역비 계산의 사본' — cols 0/1/2/3 = 이름/전화번호/금액/최종수기평.
Rate table (최종수기평 → 금액): 5→400k, 4→320k, 3→280k, 2→200k, 1→200k. 73 students, ₩19.6M.

Matches to D1 authors (cohort 8, 우선선발) by (name, phone) then name; emits UPDATE authors.
Never touches unmatched authors (they keep scholarship_amount=0). Prints unmatched both ways.
"""
import csv
import re
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from etl_sheet_to_d1 import normalize_name  # noqa: E402

FEE_CSV = Path("out/8gi_fee_raw.csv")


def digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def sql_str(v) -> str:
    if v is None or not str(v).strip():
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def parse_final_score(raw: str) -> tuple[int | None, str | None]:
    """'5/작가ㄷㄷ' → (100, '작가ㄷㄷ'). total_score = 수기평(1-5) × 20."""
    m = re.match(r"\s*([1-5])\s*/(.*)", raw or "")
    if not m:
        return None, None
    return int(m.group(1)) * 20, (m.group(2).strip() or None)


def main() -> None:
    import json
    authors = json.load(open("out/8gi_priority_authors.json"))[0]["results"]
    subs = {r["author_id"]: r["id"] for r in json.load(open("out/8gi_priority_subs.json"))[0]["results"]}
    by_name_phone: dict[tuple[str, str], list[dict]] = {}
    by_name: dict[str, list[dict]] = {}
    for a in authors:
        n = normalize_name(a["name"])
        by_name.setdefault(n, []).append(a)
        by_name_phone.setdefault((n, digits(a["phone"])), []).append(a)

    rows = list(csv.reader(open(FEE_CSV, encoding="utf-8")))
    fee_students = [r for r in rows[1:] if r and r[0].strip()]

    updates: list[tuple[str, int, str]] = []       # (author_id, amount, label)
    evals: list[tuple[str, int, str | None, str]]  # (author_id, total_score, comment, label)
    evals = []
    matched_author_ids: set[str] = set()
    unmatched_fee: list[str] = []
    for r in fee_students:
        name = normalize_name(r[0])
        phone = digits(r[1]) if len(r) > 1 else ""
        amount_raw = r[2] if len(r) > 2 else ""
        amount = int(re.sub(r"[^\d]", "", amount_raw)) if amount_raw.strip() else 0
        final_raw = r[3] if len(r) > 3 else ""
        cand = by_name_phone.get((name, phone)) or by_name.get(name)
        if not cand:
            unmatched_fee.append(f"{r[0]} / {r[1]} / {amount_raw}")
            continue
        if len(cand) > 1:
            print(f"warn: homonym in D1 for {name} ({len(cand)} rows) — skipping, resolve manually", file=sys.stderr)
            unmatched_fee.append(f"{r[0]} / {r[1]} / {amount_raw} (homonym)")
            continue
        a = cand[0]
        updates.append((a["id"], amount, f"{r[0]} {amount_raw}"))
        matched_author_ids.add(a["id"])
        score, comment = parse_final_score(final_raw)
        if score is None:
            print(f"warn: unparseable 최종수기평 for {name}: {final_raw!r}", file=sys.stderr)
        else:
            evals.append((a["id"], score, comment, f"{r[0]} {final_raw}"))

    # --- fee: authors.scholarship_amount ---
    fee_sql = ["-- 8기 우선선발 용역비 → authors.scholarship_amount",
               f"-- {len(updates)} matched, total {sum(u[1] for u in updates):,}원"]
    for aid, amount, label in updates:
        fee_sql.append(f"UPDATE authors SET scholarship_amount = {amount} WHERE id = '{aid}';  -- {label}")
    Path("out/load_8gi_priority_fee.sql").write_text("\n".join(fee_sql) + "\n", encoding="utf-8")

    # --- evaluations: collapse dual-reviewer rows → 1 row/author, score = 최종수기평 × 20 ---
    # Only the 73 fee-tab students; the 2 without a 최종수기평 keep their raw 수기평 evals.
    ev_sql = ["-- 8기 우선선발 평가 정규화: 작성자 1행, total_score = 최종수기평 × 20 (evidence 허/송)",
              f"-- {len(evals)} authors normalized; 2 authors absent from fee tab left untouched"]
    for aid, score, comment, label in evals:
        sid = subs.get(aid)
        eid = "evaluation_" + secrets.token_hex(8)
        ev_sql.append(f"DELETE FROM evaluations WHERE author_id = '{aid}';")
        ev_sql.append(
            "INSERT INTO evaluations (id, author_id, submission_id, evaluator_type, "
            "total_score, evaluation_summary, evidence) VALUES ("
            f"'{eid}', '{aid}', {sql_str(sid)}, 'manual', {score}, {sql_str(comment)}, '허/송');  -- {label}"
        )
    Path("out/load_8gi_priority_evals.sql").write_text("\n".join(ev_sql) + "\n", encoding="utf-8")

    print(f"matched {len(updates)}/{len(fee_students)} fee rows, total {sum(u[1] for u in updates):,}원")
    print(f"normalized evals for {len(evals)} authors")
    unmatched_authors = [f"{a['name']} / {a['phone']}" for a in authors if a["id"] not in matched_author_ids]
    print(f"D1 authors with no fee row ({len(unmatched_authors)}): {unmatched_authors}")
    if unmatched_fee:
        print(f"fee rows not matched to D1 ({len(unmatched_fee)}): {unmatched_fee}")


if __name__ == "__main__":
    main()

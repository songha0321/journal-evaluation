# -*- coding: utf-8 -*-
"""추출된 용역비(/tmp/fees.json)를 D1 authors와 매칭해 적용 SQL 생성.

저장 위치: authors.scholarship_amount (migration 0006 이후 장학금은 author 단위).
 - 매칭된 author 행을 UPDATE. 6기는 자료 없음 → 미생성.
 - 동명이인(D1 중복 author=같은 사람)은 전화로 구분, 불가 시 전 후보 적용 + 경고.

이름(+전화) 정규화 매칭.
출력: out/load_service_fee.sql  (검토 후 wrangler --file 로 적용)
"""
import json, re, sys, unicodedata
from collections import defaultdict

_P = re.compile(r"\s*\([^)]*\)\s*$"); _L = re.compile(r"[A-Za-z]+$")
def nn(x):
    x = unicodedata.normalize("NFC", str(x or "")).strip()
    while True:
        b = x; x = _P.sub("", x).strip(); x = _L.sub("", x).strip()
        if x == b: break
    return x.replace(" ", "")
def np_(x): return re.sub(r"\D", "", str(x or ""))
def esc(s): return str(s).replace("'", "''")

A = json.loads((s := open("/tmp/authors.json").read())[s.index("["):])[0]["results"]
fees = json.load(open("/tmp/fees.json"))

# authors index: (cohort, name) -> list
idx = defaultdict(list)
for a in A:
    idx[(a["cohort"], nn(a["name"]))].append(a)

# fee per (cohort,name): keep max amount + a grade label (5기 src "5:B")
best = {}
for f in fees:
    k = (f["cohort"], f["name"])
    if k not in best or f["amount"] > best[k]["amount"]:
        best[k] = f

L = ["-- load_service_fee.sql : 최종 용역비 -> authors.scholarship_amount"]
matched = skipped = upd = 0
warns = []
for (coh, name), f in sorted(best.items()):
    cands = idx.get((coh, name), [])
    if not cands:
        skipped += 1; continue
    if len(cands) > 1:
        ph = np_(f.get("phone"))
        pick = [c for c in cands if ph and np_(c.get("phone")) == ph]
        if len(pick) == 1:
            cands = pick
        else:
            # 동명이인 = D1 중복 author(같은 사람). 모든 후보 행에 동일 적용.
            warns.append(f"DUP cohort{coh} {name} x{len(cands)} (phone 불충분) — 전 후보 적용")
    amt = int(f["amount"]); matched += 1
    for c in cands:
        L.append(f"UPDATE authors SET scholarship_amount={amt} WHERE id='{c['id']}';")
        upd += 1

open("out/load_service_fee.sql", "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"매칭 {matched} | UPDATE문(author) {upd} | 스킵(미매칭/모호) {skipped}")
for w in warns: print("  " + w)
print(f"wrote out/load_service_fee.sql ({len(L)} stmts)")

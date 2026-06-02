# -*- coding: utf-8 -*-
"""기존 5~9기 스프레드시트의 '최종 용역비' 탭에서 학생별 실지급 용역비를 추출.

각 탭 레이아웃이 달라 코호트별로 (이름, 전화, 금액)을 뽑는 규칙을 따로 둔다.
출력: records = [{cohort, student_type, name, phone, amount}], + per-cohort 진단.

용역비 없음(자료 미존재): 6기, 5기 포레스트, 5기 성적향상.
"""
import json, re, sys, unicodedata
import openpyxl

SHEETS = "/tmp/sheets"

_PARENS = re.compile(r"\s*\([^)]*\)\s*$")
_LATIN = re.compile(r"[A-Za-z]+$")

def norm_name(raw):
    n = unicodedata.normalize("NFC", str(raw or "")).strip()
    while True:
        b = n
        n = _PARENS.sub("", n).strip()
        n = _LATIN.sub("", n).strip()
        if n == b:
            break
    return n.replace(" ", "")

def norm_phone(raw):
    d = re.sub(r"\D", "", str(raw or ""))
    return d

def to_won(raw):
    """'100,000' / 100000 / 40(만원 단위 아님) -> int 원. None if unparseable."""
    if raw is None:
        return None
    s = re.sub(r"[^\d.]", "", str(raw))
    if not s:
        return None
    try:
        return int(round(float(s)))
    except ValueError:
        return None

def load(sid, tab):
    wb = openpyxl.load_workbook(f"{SHEETS}/{sid}.xlsx", read_only=True, data_only=True)
    return list(wb[tab].iter_rows(values_only=True))

def cell(r, i):
    return r[i] if r is not None and i < len(r) and r[i] is not None else None

records = []
diag = {}

def add(cohort, stype, name, phone, amount, src):
    nm = norm_name(name)
    if not nm or amount is None:
        return False
    records.append({"cohort": cohort, "student_type": stype, "name": nm,
                    "phone": norm_phone(phone), "amount": int(amount), "src": src})
    return True

# ---- 7기 성적우수: tab '수기 용역비', header r0, 이름 col3, 용역비 col7 ('100,000')
def do_7():
    rows = load("1oSpcV-TSNXWySBjBflXKP0tnxbapP-9wJU2j1eFLz4c", "수기 용역비")
    n = 0
    for r in rows[1:]:
        name = cell(r, 3)
        amt = to_won(cell(r, 7))
        if add(7, "성적우수", name, cell(r, 4), amt, "7"):
            n += 1
    diag["7기-우수"] = n

# ---- 8기 성적향상: '용역비 계산', 이름 col0, 금액 col5 (header at row with '이름')
def do_8hs():
    rows = load("1otAR9jLZDUMW9FiSimuAPd9eewRQxZ7voDZsWgdXQic", "용역비 계산")
    n = 0
    started = False
    for r in rows:
        if not started:
            if cell(r, 0) == "이름":
                started = True
            continue
        name = cell(r, 0)
        amt = to_won(cell(r, 5))
        if add(8, "성적향상", name, cell(r, 1), amt, "8hs"):
            n += 1
    diag["8기-향상"] = n

# ---- 8기 성적우수: '용역비 계산', 이름 col0, 금액 col3 (header r0)
def do_8su():
    rows = load("1vElhfl-Bc0XBH4Z3XtJINe4_2qdwCzEJ4GQ2poCfLjg", "용역비 계산")
    n = 0
    for r in rows[1:]:
        name = cell(r, 0)
        if name == "이름":
            continue
        amt = to_won(cell(r, 3))
        if add(8, "성적우수", name, cell(r, 1), amt, "8su"):
            n += 1
    diag["8기-우수"] = n

# ---- 9기 성적우수: '3-2. 용역비 계산', 이름 col1, 용역비 col6 (header r2)
def do_9su():
    rows = load("1i_ivPMlik2kirejT3ORjyHn5Gc8aoR_4v0hBU3b63R0", "3-2. 용역비 계산")
    n = 0
    for r in rows:
        name = cell(r, 1)
        if not name or name == "이름":
            continue
        amt = to_won(cell(r, 6))
        if add(9, "성적우수", name, cell(r, 2), amt, "9su"):
            n += 1
    diag["9기-우수"] = n

# ---- 9기 우선선발: '4. 용역비 계산', per-student 블록 col12=name,14=phone,15=grade
#      등급→용역비: 5:400000 4:320000 3:280000 2:240000 1:200000
def do_9wp():
    grade_amt = {5: 400000, 4: 320000, 3: 280000, 2: 240000, 1: 200000}
    rows = load("1Tra3_vaYocMM-7OJXMM4vrBTtEeCQxrUET1y4eIlV-g", "4. 용역비 계산")
    n = 0
    for r in rows:
        name = cell(r, 12)
        g = cell(r, 15)
        if not name or name == "이름":
            continue
        gv = to_won(g)
        amt = grade_amt.get(gv) if gv in grade_amt else None
        if add(9, "우선선발", name, cell(r, 14), amt, "9wp"):
            n += 1
    diag["9기-우선"] = n

# ---- 5기: '수기 평가 시트_220214' 의 학생별 최종등급(col8) → 금액표 매핑.
#      금액표('수기 금액 정리'): S40 A++35 A+35 A30 B20 C15 F10 F-10 (만원)
#      ('성적우수자 65명' = 우수+향상 혼재; 포레스트는 평가/금액 자료 없음)
def do_5():
    GRADE = {"S": 400000, "A++": 350000, "A+": 350000, "A": 300000,
             "B": 200000, "C": 150000, "F": 100000, "F-": 100000}
    rows = load("1mswtrOw_Se2ZX4a7s0j3HV24AwySXhIF5VOtpAil-3g", "수기 평가 시트_220214")
    n = 0
    for r in rows[1:]:
        name = cell(r, 2)
        grade = str(cell(r, 8) or "").strip()
        if not name:
            continue
        amt = GRADE.get(grade)
        # 향상자 태그(col15) 있으면 성적향상, 아니면 성적우수
        tag = str(cell(r, 15) or "")
        stype = "성적향상" if "향상" in tag else "성적우수"
        if add(5, stype, name, None, amt, "5:" + grade):
            n += 1
    diag["5기(평가시트)"] = n

for fn in (do_5, do_7, do_8hs, do_8su, do_9su, do_9wp):
    try:
        fn()
    except Exception as e:
        diag[fn.__name__] = f"ERR {e}"

json.dump(records, open("/tmp/fees.json", "w"), ensure_ascii=False)
print("=== 추출 진단 (코호트별 행수) ===")
for k, v in diag.items():
    print(f"  {k}: {v}")
print(f"총 추출: {len(records)}")
# 금액 분포
from collections import Counter, defaultdict
bycoh = defaultdict(Counter)
for r in records:
    bycoh[(r['cohort'], r['student_type'])][r['amount']] += 1
print("\n=== 코호트별 금액 분포 ===")
for k in sorted(bycoh):
    items = sorted(bycoh[k].items())
    tot = sum(a * c for a, c in items)
    print(f"  {k}: " + ", ".join(f"{a:,}×{c}" for a, c in items) + f"  | 합계 {tot:,}")

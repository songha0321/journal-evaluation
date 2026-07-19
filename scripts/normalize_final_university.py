#!/usr/bin/env python3
"""Normalize authors.final_university → 'OO대학교 OO과/학부' 형식.

자유서술 원본을 표준형으로 통일한다. 확실한 케이스만 자동 변환하고,
문장형/복수지원/발표대기 등 단일 학교·학과로 못 좁히는 건 UNRESOLVED로 남긴다.
결과: out/univ_normalize.tsv (before<TAB>after<TAB>status), 적용 SQL은 별도.
"""
import json
import re
import sys
from collections import Counter

RAW = "out/univ_raw.json"  # SELECT cohort, final_university fu ... (non-empty, non '-')

# 표준 학교명(≥2자 별칭만; 단일 문자는 축약 화이트리스트에서만 안전하게 처리)
SCHOOL = {
    "서울대": "서울대학교", "연세대": "연세대학교", "고려대": "고려대학교", "고대": "고려대학교",
    "성균관대": "성균관대학교", "성대": "성균관대학교", "성균관": "성균관대학교",
    "가톨릭대": "가톨릭대학교", "가톨릭": "가톨릭대학교",
    "한양대": "한양대학교", "한양": "한양대학교", "중앙대": "중앙대학교", "중앙": "중앙대학교",
    "경희대": "경희대학교", "경희": "경희대학교",
    "이화여대": "이화여자대학교", "이화": "이화여자대학교", "이대": "이화여자대학교",
    "울산대": "울산대학교", "충북대": "충북대학교", "충남대": "충남대학교", "부산대": "부산대학교",
    "인제대": "인제대학교", "인하대": "인하대학교", "아주대": "아주대학교",
    "강원대": "강원대학교", "한림대": "한림대학교", "순천향대": "순천향대학교",
    "가천대": "가천대학교", "서강대": "서강대학교", "홍익대": "홍익대학교", "강릉원주대": "강릉원주대학교",
}
# 축약(설/연/고/… 1자 + 한양/중앙/경희/이화 2자)은 '설의','한양의','설경영'처럼 앵커된 fullmatch에서만.
ABBR1 = {"설": "서울대학교", "연": "연세대학교", "고": "고려대학교", "성": "성균관대학교",
         "가": "가톨릭대학교", "울": "울산대학교",
         "한양": "한양대학교", "중앙": "중앙대학교", "경희": "경희대학교", "이화": "이화여자대학교"}
DEPT_ABBR = {"의": "의예과", "경영": "경영학과", "경제": "경제학부", "인문": "인문계열",
             "언정": "언론정보학과", "사회": "사회학과", "지리": "지리학과"}

MED_RE = re.compile(r"의대|의예|의과|의학|의에과")
# 문장형/복수지원/미확정 마커 — 하나라도 있으면 단일 표준형으로 강제하지 않음
AMBIG_RE = re.compile(r"발표|고민|대기|기다|미발표|아직|예정입니다|예비|추합|미정|모르|아마|것\s*같|갑니당|옮길|중이다|중 입니다|중입니다| or |또는|가능성|지원\b|안함|안 났|합불|우선순위")


def canon_school(text: str) -> str | None:
    """≥2자 학교명이 문자열에 나타나면 표준명 반환. 단일 문자 별칭은 쓰지 않음(오매칭 방지)."""
    for alias in sorted(SCHOOL, key=len, reverse=True):
        if alias in text.replace(" ", ""):
            return SCHOOL[alias]
    return None


def strip_school(flat: str, school: str) -> str:
    """학과 추출 전에 학교명/별칭·'대학교'·'대학'을 제거해 학과 토큰만 남긴다."""
    # 표준 학교명(…대학교) 먼저 제거해야 '학교' 잔여가 안 남는다.
    removers = [school] + sorted([a for a, v in SCHOOL.items() if v == school], key=len, reverse=True)
    t = flat
    for r in removers:
        t = t.replace(r, "")
    return t.replace("대학교", "").replace("대학", "").replace("학교", "").replace("/", "").strip()


def extract_dept(flat: str, school: str) -> str | None:
    """의약계열은 표준 학과명, 그 외는 원문 학과 토큰을 그대로 보존."""
    if re.search(r"한의", flat):
        return "한의예과"
    if re.search(r"치의|치대", flat):
        return "치의예과"
    if MED_RE.search(flat):
        return "의예과"
    if re.search(r"약학|약대", flat):
        return "약학대학"
    body = strip_school(flat, school)
    m = re.search(r"[가-힣]+(?:학과|학부|계열)", body)  # 생명과학과·컴퓨터학부·인문계열 등 원문 보존
    if m:
        return m.group(0)
    m = re.search(r"[가-힣]{2,}과$", body)
    return m.group(0) if m else None


def count_schools(flat: str) -> int:
    return len({v for a, v in SCHOOL.items() if a in flat})


def normalize(raw: str) -> tuple[str | None, str]:
    """returns (normalized_or_None, status)."""
    s = raw.strip()
    flat = s.replace(" ", "")

    # 1) 축약형 먼저(앵커된 fullmatch라 안전): 설의/한양의/가의/설경영/설경제 등
    m = re.fullmatch(r"([가-힣]{1,2})(의|경영|경제|인문|언정|사회|지리)", flat)
    if m and m.group(1) in ABBR1:
        return f"{ABBR1[m.group(1)]} {DEPT_ABBR[m.group(2)]}", "OK"

    # 2) 문장형/복수지원/미확정 → 표준형 강제 불가
    both_sides = re.search(r"[가-힣]+(진학|합격)/[가-힣]+(진학|합격)", flat)
    if len(s) > 22 or AMBIG_RE.search(s) or count_schools(flat) >= 2 or both_sides:
        return None, "UNRESOLVED"

    school = canon_school(s)
    if not school:
        return None, "UNRESOLVED"
    dept = extract_dept(flat, school)
    if dept is None:
        return school, "SCHOOL_ONLY"
    return f"{school} {dept}", "OK"


def main() -> None:
    rows = json.load(open(RAW))[0]["results"]
    distinct = Counter(r["fu"] for r in rows)
    out_lines, sql_lines = [], []
    stat = Counter()
    for raw, n in distinct.most_common():
        norm, status = normalize(raw)
        stat[status] += 1
        out_lines.append(f"{raw}\t{norm or ''}\t{status}\t{n}")
        if status in ("OK", "SCHOOL_ONLY") and norm and norm != raw:
            esc = raw.replace("'", "''")
            nesc = norm.replace("'", "''")
            sql_lines.append(f"UPDATE authors SET final_university = '{nesc}' WHERE final_university = '{esc}';  -- x{n} [{status}]")
    open("out/univ_normalize.tsv", "w", encoding="utf-8").write("BEFORE\tAFTER\tSTATUS\tN\n" + "\n".join(out_lines) + "\n")
    open("out/univ_normalize.sql", "w", encoding="utf-8").write("\n".join(sql_lines) + "\n")
    print("status:", dict(stat))
    print(f"distinct={len(distinct)} rows={sum(distinct.values())}  SQL updates={len(sql_lines)}")


if __name__ == "__main__":
    main()

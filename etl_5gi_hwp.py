"""
5기 수기 .hwp/.hwpx 본문 → D1 ETL (기존 5기 author에 attach).

etl_5gi.py 가 구글시트로 5기 authors/submissions 를 적재했지만, qna(수기 본문)는
비어 있다. 이 스크립트는 로컬 .hwp/.hwpx 답안지에서 본문을 추출해, 기존 5기 author에
questions/qna 를 붙이고 author 인적정보(birthdate/hall/class_name/admission_score)를 갱신한다.

설계:
  * 추출:  .hwp -> hwp5html -> 블록경계 텍스트 / .hwpx -> zip+<hp:t>
  * 매칭:  로컬파일의 이름(문서 기본인적사항 우선, 파일명 fallback)을 normalize 후
           D1 cohort=5 author 와 매칭. 로컬 폴더명은 student_type 으로 신뢰하지 않는다
           (혼합 시트라 성적우수 폴더에 성적향상 학생이 섞여 있음).
  * 중복:  같은 사람의 재제출(파일명 날짜/(1)/수정본)은 최신 1개만 사용.
  * 동명이인: D1에 같은 이름 2명이면 최종대학으로 1차 disambiguate, 그래도 모호하면 skip+warn.

1단계(현재): --report 만. 매칭 결과만 출력하고 SQL은 만들지 않는다.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import zipfile
import glob
import os
import struct
import tempfile
import zlib
from pathlib import Path

COHORT = 5

_NAME_TRAILING_PARENS = re.compile(r"\s*\([^)]*\)\s*$")
_NAME_TRAILING_LATIN = re.compile(r"[A-Za-z]+$")


def normalize_name(raw: str) -> str:
    n = (raw or "").strip()
    # strip zero-width / invisible marks sometimes pasted into 이름 cells
    n = re.sub(r"[​‌‍­⁠﻿]", "", n).strip()
    while True:
        before = n
        n = _NAME_TRAILING_PARENS.sub("", n).strip()
        n = _NAME_TRAILING_LATIN.sub("", n).strip()
        if n == before:
            return n


# ---------- extraction ----------

def _clean_html(html: str) -> str:
    html = re.sub(r"<style.*?</style>", " ", html, flags=re.S | re.I)
    # Drop everything up to and including <body ...> via index slice — a global
    # re.sub(r".*?<body...>") backtracks O(n²) (116s on a 170KB doc) because it
    # rescans to EOF at every position once the only <body> is consumed.
    m = re.search(r"<body[^>]*>", html, flags=re.I)
    if m:
        html = html[m.end():]
    html = re.sub(r"</?(p|div|tr|td|th|br|li|h[1-6]|table)[^>]*>", "\n", html, flags=re.I)
    html = re.sub(r"<[^>]+>", "", html)
    html = re.sub(r"&#13;", " ", html)
    html = html.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&nbsp;", " ")
    html = re.sub(r"&[a-zA-Z]+;", " ", html)
    out, prev = [], None
    for raw in html.splitlines():
        l = re.sub(r"[ \t]+", " ", raw).strip()
        if l and l != prev:
            out.append(l)
        prev = l
    return "\n".join(out)


def extract_text(path: str) -> str:
    if path.lower().endswith(".hwpx"):
        texts = []
        with zipfile.ZipFile(path) as z:
            for n in sorted(z.namelist()):
                if n.startswith("Contents/section") and n.endswith(".xml"):
                    xml = z.read(n).decode("utf-8", "ignore")
                    texts += re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", xml, flags=re.S)
        txt = "\n".join(re.sub(r"<[^>]+>", "", t) for t in texts)
        txt = txt.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
        return "\n".join(l.strip() for l in txt.splitlines() if l.strip())
    d = tempfile.mkdtemp()
    subprocess.run(["hwp5html", "--output", d, path],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
                   timeout=45)
    f = glob.glob(os.path.join(d, "*.xhtml")) + glob.glob(os.path.join(d, "*.html"))
    html = open(f[0], encoding="utf-8").read()
    # Guard against pathological docs: cap size before regex passes (1.5MB+ 수정본s).
    if len(html) > 3_000_000:
        html = html[:3_000_000]
    return _clean_html(html)


# ---------- 기본 인적사항 파싱 ----------

def parse_identity(lines: list[str]) -> dict:
    """라벨 줄 다음 값 줄을 줍는다. 라벨은 알려진 집합으로 한정."""
    LABELS = {
        "이름": "name",
        "나이(생년)": "birth", "나이": "birth",
        "소속 관&반": "hall_class", "소속 관 반": "hall_class", "소속관반": "hall_class",
        "N수 경력": "nsu", "n수 경력": "nsu",
        "시대N 재원 기수": "cohort", "시대N 재원기수": "cohort",
        "학원 등원 방식": "commute",
        "최종 진학 대학": "final_univ", "최종대학": "final_univ", "최종 합격 대학": "final_univ",
    }
    out: dict = {}
    for i, l in enumerate(lines):
        key = LABELS.get(l.strip())
        if not key or key in out:
            continue
        # next non-empty, non-guide line
        for j in range(i + 1, min(i + 4, len(lines))):
            v = lines[j].strip()
            if not v or v.startswith("*") or v in LABELS:
                continue
            out[key] = v
            break
    return out


def extract_name_from_filename(path: str) -> str:
    base = os.path.basename(path)
    base = re.sub(r"\.(hwpx?|docx?|pdf)$", "", base, flags=re.I)
    # patterns: '5기수기_이름_날짜 - 별칭', '22수기_이름_...', '시대N5기_수기답안지_이름'
    m = re.search(r"수기[_\- ]*([가-힣]{2,4})[_\- ]", base)
    if m:
        return m.group(1)
    # fallback: token after first underscore
    parts = re.split(r"[_\-]", base)
    for p in parts:
        p = p.strip()
        if re.fullmatch(r"[가-힣]{2,4}", p):
            return p
    return ""


def file_date_key(path: str) -> str:
    """재제출 중복에서 최신 고르기용 정렬 키. 파일명 날짜 + mtime."""
    base = os.path.basename(path)
    m = re.search(r"(\d{6}|\d{8})", base)
    d = m.group(1) if m else "000000"
    bonus = "1" if ("수정" in base) else "0"
    return f"{d}_{bonus}_{os.path.getmtime(path):.0f}"


# ---------- D1 ----------

def fetch_d1_authors() -> list[dict]:
    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "sdij-journal", "--remote", "--json",
         "--command",
         "SELECT a.id, a.name, a.student_type, a.final_university, a.memo, "
         "s.id AS submission_id, s.file_url "
         "FROM authors a LEFT JOIN submissions s ON s.author_id = a.id "
         f"WHERE a.cohort = {COHORT};"],
        capture_output=True, text=True,
    )
    out = proc.stdout
    i = out.find("[")
    if i < 0:
        print(proc.stderr, file=sys.stderr)
        raise SystemExit("D1 query failed")
    payload = json.loads(out[i:])
    return payload[0]["results"]


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dirs", nargs="+", required=True, help="수기 .hwp 폴더들")
    ap.add_argument("--report", action="store_true", help="매칭 리포트만 출력")
    args = ap.parse_args()

    # gather files
    files: list[str] = []
    for d in args.dirs:
        for ext in ("*.hwp", "*.hwpx"):
            files += glob.glob(os.path.join(d, "**", ext), recursive=True)
    files = sorted(set(files))
    print(f"로컬 파일 {len(files)}개", file=sys.stderr)

    # parse each
    parsed = []
    for idx, f in enumerate(files, 1):
        print(f"  [{idx}/{len(files)}] {os.path.basename(f)}", file=sys.stderr, flush=True)
        try:
            txt = extract_text(f)
        except Exception as e:
            print(f"      ! {e}", file=sys.stderr, flush=True)
            parsed.append({"path": f, "error": str(e)})
            continue
        lines = txt.splitlines()
        ident = parse_identity(lines)
        doc_name = normalize_name(ident.get("name", ""))
        fn_name = normalize_name(extract_name_from_filename(f))
        parsed.append({
            "path": f,
            "name": doc_name or fn_name,
            "doc_name": doc_name,
            "fn_name": fn_name,
            "final_univ": ident.get("final_univ", ""),
            "birth": ident.get("birth", ""),
            "hall_class": ident.get("hall_class", ""),
            "nsu": ident.get("nsu", ""),
            "chars": len(txt),
            "datekey": file_date_key(f),
        })

    # dedup local resubmissions by name (keep latest datekey)
    by_name: dict[str, dict] = {}
    dupes = []
    for p in parsed:
        if p.get("error") or not p.get("name"):
            continue
        nm = p["name"]
        if nm not in by_name or p["datekey"] > by_name[nm]["datekey"]:
            if nm in by_name:
                dupes.append((nm, by_name[nm]["path"]))
            by_name[nm] = p
        else:
            dupes.append((nm, p["path"]))

    # D1 authors
    d1 = fetch_d1_authors()
    d1_by_name: dict[str, list[dict]] = {}
    for r in d1:
        d1_by_name.setdefault(normalize_name(r["name"]), []).append(r)

    matched, ambiguous, unmatched = [], [], []
    for nm, p in sorted(by_name.items()):
        cands = d1_by_name.get(nm, [])
        if len(cands) == 1:
            matched.append((p, cands[0]))
        elif len(cands) == 0:
            unmatched.append(p)
        else:
            # disambiguate by final_university substring
            fu = p.get("final_univ", "")
            narrowed = [c for c in cands if fu and c.get("final_university")
                        and (fu[:4] in (c["final_university"] or "") or (c["final_university"] or "")[:4] in fu)]
            if len(narrowed) == 1:
                matched.append((p, narrowed[0]))
            else:
                ambiguous.append((p, cands))

    # report
    print("\n========== 매칭 리포트 ==========")
    print(f"로컬 고유 인물: {len(by_name)} | D1 5기 author: {len(d1)} ({len(d1_by_name)} 고유이름)")
    print(f"  ✅ 매칭: {len(matched)}")
    print(f"  ⚠️  동명이인 모호: {len(ambiguous)}")
    print(f"  ❓ D1에 없음: {len(unmatched)}")
    print(f"  🔁 로컬 재제출 중복(제외됨): {len(dupes)}")

    if ambiguous:
        print("\n--- ⚠️ 동명이인 모호 (수동 확인 필요) ---")
        for p, cands in ambiguous:
            print(f"  {p['name']} | hwp최종대학='{p['final_univ']}' 생년='{p['birth']}'")
            for c in cands:
                print(f"      D1: {c['id']} type={c['student_type']} 대학='{c.get('final_university')}'")
    if unmatched:
        print("\n--- ❓ D1에 없는 로컬 인물 ---")
        for p in unmatched:
            print(f"  {p['name']}  (doc='{p['doc_name']}' fn='{p['fn_name']}')  {os.path.basename(p['path'])}")
    if dupes:
        print("\n--- 🔁 제외된 재제출 중복 ---")
        for nm, path in dupes:
            print(f"  {nm}: {os.path.basename(path)}")

    errs = [p for p in parsed if p.get("error")]
    if errs:
        print("\n--- ❌ 추출 실패 ---")
        for p in errs:
            print(f"  {os.path.basename(p['path'])}: {p['error']}")


if __name__ == "__main__":
    main()

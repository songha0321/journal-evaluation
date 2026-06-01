#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
수기 답안지(.hwp/.hwpx/.docx/.txt) 본문 → D1 questions/qna/authors 적재 SQL 생성.

흐름:
  1. --dirs 의 모든 답안지 파일에서 본문 추출 (hwp5html, 실패 시 olefile BodyText fallback).
  2. parse_sugi 로 (기본 인적사항, 질문별 답변) 분해.  5기=A1~C3 / 6기=[N],[N-M].
  3. 같은 사람의 재제출(파일명 날짜/(1)/수정본)은 최신 1개만.
  4. 질문키별 빈출 라인(템플릿 가이드)을 빈도 기반으로 제거(strip_boilerplate).
  5. SQL 생성:
       - questions  : cohort별 질문 셋 시드 (canonical 헤더, category, sort_order).
       - 5기 author : D1 기존 author(중복 정리 완료)와 이름 매칭 → hall/class_name COALESCE 보강.
       - 6기 author : 신규 INSERT (이름 기준 NOT EXISTS).
       - qna        : author별 기존 qna 삭제 후 답변 INSERT (idempotent).
       - 6기 submission: author당 source_type='hwp' submission 1건 (qna는 author 기준 링크).

출력 .sql 은 `npx wrangler d1 execute sdij-journal --remote --file <out>` 로 적용.
report-only(--report)면 매칭/분해 통계만 출력하고 SQL은 만들지 않는다.
"""
import argparse
import glob
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
import zlib
from collections import Counter, defaultdict

import olefile

import parse_sugi as ps


# ---------------- name ----------------
_PARENS = re.compile(r"\s*\([^)]*\)\s*$")
_LATIN = re.compile(r"[A-Za-z]+$")
_ZW = re.compile(r"[​‌‍­⁠﻿]")


def normalize_name(raw):
    n = unicodedata.normalize("NFC", raw or "").strip()
    n = _ZW.sub("", n)
    n = re.sub(r"\s+", " ", n)
    while True:
        before = n
        n = _PARENS.sub("", n).strip()
        n = _LATIN.sub("", n).strip()
        if n == before:
            break
    return n.replace(" ", "")          # 내부 공백 제거: '김 하 연' -> '김하연'


# ---------------- extraction ----------------
def _clean(text):
    text = text.replace("\x00", "")
    text = "".join(c for c in text if c in "\n\t" or ord(c) >= 32)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _hwp_olefile(path):
    ole = olefile.OleFileIO(path)
    try:
        fh = ole.openstream("FileHeader").read()
        comp = bool(struct.unpack("<I", fh[36:40])[0] & 1)
        secs = sorted((s for s in ole.listdir() if len(s) == 2 and s[0] == "BodyText"),
                      key=lambda s: int(re.sub(r"\D", "", s[1]) or 0))
        CHARC = {0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31}
        WIDE = set(range(1, 24)) - {10, 13}
        out = []
        for sec in secs:
            raw = ole.openstream(sec).read()
            if comp:
                raw = zlib.decompress(raw, -15)
            i = 0
            while i + 4 <= len(raw):
                h = struct.unpack_from("<I", raw, i)[0]; i += 4
                tag = h & 0x3FF; size = (h >> 20) & 0xFFF
                if size == 0xFFF:
                    size = struct.unpack_from("<I", raw, i)[0]; i += 4
                data = raw[i:i + size]; i += size
                if tag == 67:
                    j = 0; s = []
                    while j + 1 < len(data):
                        c = struct.unpack_from("<H", data, j)[0]
                        if c in CHARC:
                            s.append("\n" if c in (10, 13) else ""); j += 2
                        elif c in WIDE:
                            j += 16
                        else:
                            s.append(chr(c)); j += 2
                    out.append("".join(s))
        return "\n".join(out)
    finally:
        ole.close()


def _hwp_hwp5html(path):
    d = tempfile.mkdtemp()
    subprocess.run(["hwp5html", "--output", d, path], stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, check=True, timeout=60)
    f = glob.glob(os.path.join(d, "*.xhtml")) + glob.glob(os.path.join(d, "*.html"))
    html = open(f[0], encoding="utf-8").read()
    if len(html) > 3_000_000:
        html = html[:3_000_000]
    m = re.search(r"<body[^>]*>", html, re.I)
    if m:
        html = html[m.end():]
    html = re.sub(r"</?(p|div|tr|td|th|br|li|h[1-6]|table)[^>]*>", "\n", html, flags=re.I)
    html = re.sub(r"<[^>]+>", "", html)
    html = (html.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
                .replace("&nbsp;", " ").replace("&#13;", " "))
    html = re.sub(r"&[a-zA-Z]+;", " ", html)
    return html


def _hwpx(path):
    texts = []
    with zipfile.ZipFile(path) as z:
        for n in sorted(z.namelist()):
            if n.startswith("Contents/section") and n.endswith(".xml"):
                xml = z.read(n).decode("utf-8", "ignore")
                xml = re.sub(r"</hp:p>", "\n", xml)
                texts += re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", xml, flags=re.S)
    txt = "\n".join(re.sub(r"<[^>]+>", "", t) for t in texts)
    return txt.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


def _docx(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    txt = re.sub(r"<[^>]+>", "", xml)
    return txt.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


def extract_text(path):
    low = path.lower()
    if low.endswith(".hwpx"):
        return _clean(_hwpx(path))
    if low.endswith(".docx"):
        return _clean(_docx(path))
    if low.endswith(".txt"):
        for enc in ("utf-8", "cp949", "utf-16"):
            try:
                return _clean(open(path, encoding=enc).read())
            except (UnicodeDecodeError, UnicodeError):
                continue
        return ""
    if low.endswith(".hwp"):
        try:
            return _clean(_hwp_hwp5html(path))
        except Exception:
            try:
                return _clean(_hwp_olefile(path))
            except Exception as e:
                print(f"  ! hwp extract failed: {os.path.basename(path)}: {e}", file=sys.stderr)
                return ""
    return ""


# ---------------- name from filename ----------------
def name_from_filename(path):
    base = re.sub(r"\.(hwpx?|docx?|pdf|txt)$", "", os.path.basename(path), flags=re.I)
    # '5기수기_이름_날짜 - 별칭' / '22수기_이름_...'
    m = re.search(r"수기[_\- ]*([가-힣]{2,4})[_\- ]", base)
    if m:
        return m.group(1)
    # '<제목> - <이름>' (6기 구글폼): 별칭이 이름인 경우만 (한글 2~4자)
    if " - " in base:
        tail = base.rsplit(" - ", 1)[1].strip()
        if re.fullmatch(r"[가-힣]{2,4}", tail):
            return tail
    for p in re.split(r"[_\-]", base):
        if re.fullmatch(r"[가-힣]{2,4}", p.strip()):
            return p.strip()
    return ""


def file_date_key(path):
    base = os.path.basename(path)
    m = re.search(r"(\d{8}|\d{6})", base)
    d = m.group(1) if m else "000000"
    return f"{d}_{'1' if '수정' in base else '0'}_{os.path.getmtime(path):.0f}"


# ---------------- D1 ----------------
def fetch_authors(cohort):
    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "sdij-journal", "--remote", "--json",
         "--command", f"SELECT id, name, student_type, hall, class_name, final_university "
                      f"FROM authors WHERE cohort={cohort};"],
        capture_output=True, text=True)
    out = proc.stdout
    i = out.find("[")
    if i < 0:
        sys.exit("D1 query failed:\n" + proc.stderr)
    return json.loads(out[i:])[0]["results"]


def esc(s):
    return (s or "").replace("'", "''")


# ---------------- main ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dirs", nargs="+", required=True)
    ap.add_argument("--cohort", type=int, required=True)
    ap.add_argument("--student-type", help="6기 신규 author용 기본 student_type")
    ap.add_argument("--out")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()
    coh = args.cohort

    files = []
    for d in args.dirs:
        for ext in ("*.hwp", "*.hwpx", "*.docx", "*.txt"):
            files += glob.glob(os.path.join(d, "**", ext), recursive=True)
    files = sorted(set(files))
    print(f"파일 {len(files)}개", file=sys.stderr)

    people = {}            # name -> {datekey, parsed, path}
    nobody, noname, dupes = [], [], []
    for idx, f in enumerate(files, 1):
        print(f"  [{idx}/{len(files)}] {os.path.basename(f)}", file=sys.stderr, flush=True)
        txt = extract_text(f)
        if not txt:
            nobody.append(f); continue
        parsed = ps.parse_manuscript(txt, coh)
        doc_name = normalize_name(parsed["identity"].get("name", ""))
        nm = doc_name or normalize_name(name_from_filename(f))
        if not nm:
            noname.append(f); continue
        dk = file_date_key(f)
        if nm not in people or dk > people[nm]["datekey"]:
            if nm in people:
                dupes.append((nm, people[nm]["path"]))
            people[nm] = {"datekey": dk, "parsed": parsed, "path": f}
        else:
            dupes.append((nm, f))

    # boilerplate from deduped people
    boiler = ps.build_boilerplate([p["parsed"] for p in people.values()])

    # canonical questions
    qtext, qcat, qkeys = {}, {}, []
    for p in people.values():
        for key, header, body, cat in p["parsed"]["segments"]:
            qtext.setdefault(key, Counter())[header] += 1
            if cat:
                qcat.setdefault(key, Counter())[cat] += 1
    def keysort(k):
        m = re.match(r"([A-Za-z]*)(\d+)(?:-(\d+))?", k)
        return (m.group(1), int(m.group(2)), int(m.group(3) or 0)) if m else (k, 0, 0)
    qkeys = sorted(qtext, key=keysort)

    # author matching (cohort 5: existing; else new)
    d1 = fetch_authors(coh)
    d1_by_name = defaultdict(list)
    for r in d1:
        d1_by_name[normalize_name(r["name"])].append(r)
    matched, newauthors, ambiguous, unmatched = {}, [], [], []
    for nm in people:
        cands = d1_by_name.get(nm, [])
        if len(cands) == 1:
            matched[nm] = cands[0]
        elif not cands:
            (newauthors if coh != 5 else unmatched).append(nm)
        else:
            ambiguous.append((nm, cands))

    print(f"\n사람 {len(people)} | 매칭 {len(matched)} | 신규 {len(newauthors)} "
          f"| 모호 {len(ambiguous)} | D1없음 {len(unmatched)} | 재제출중복 {len(dupes)} "
          f"| 본문없음 {len(nobody)} | 이름없음 {len(noname)}", file=sys.stderr)
    if ambiguous:
        print("  모호:", [n for n, _ in ambiguous], file=sys.stderr)
    if unmatched:
        print("  D1없음:", unmatched, file=sys.stderr)
    if noname:
        print("  이름없음:", [os.path.basename(f) for f in noname], file=sys.stderr)
    if nobody:
        print("  본문없음:", [os.path.basename(f) for f in nobody], file=sys.stderr)

    if args.report or not args.out:
        return

    L = ["PRAGMA foreign_keys = ON;", "-- questions seed"]
    for i, k in enumerate(qkeys, 1):
        t = esc(qtext[k].most_common(1)[0][0])
        c = esc(qcat[k].most_common(1)[0][0]) if k in qcat else ""
        L.append(f"INSERT INTO questions (cohort, question_key, question_text, category, sort_order) "
                 f"SELECT {coh},'{esc(k)}','{t}','{c}',{i} "
                 f"WHERE NOT EXISTS (SELECT 1 FROM questions WHERE cohort={coh} AND question_key='{esc(k)}');")

    def emit_qna_by_name(nm):
        p = people[nm]["parsed"]
        L.append(f"DELETE FROM qna WHERE author_id IN (SELECT id FROM authors WHERE name='{esc(nm)}' AND cohort={coh});")
        for key, header, body, cat in p["segments"]:
            ans = ps.strip_boilerplate(body, boiler.get(key, set()))
            if not ans:
                continue
            L.append(f"INSERT INTO qna (author_id, question_id, answer_text) "
                     f"SELECT a.id, q.id, '{esc(ans)}' FROM authors a, questions q "
                     f"WHERE a.name='{esc(nm)}' AND a.cohort={coh} "
                     f"AND q.cohort={coh} AND q.question_key='{esc(key)}';")

    # matched (5기): light identity fill + qna
    L.append("-- matched authors (identity fill + qna)")
    for nm, a in matched.items():
        ident = people[nm]["parsed"]["identity"]
        hc = ident.get("hall_class", "")
        if hc:
            parts = hc.split(None, 1)
            hall, cls = parts[0], (parts[1] if len(parts) > 1 else "")
            L.append(f"UPDATE authors SET hall=COALESCE(NULLIF(hall,''),'{esc(hall)}'), "
                     f"class_name=COALESCE(NULLIF(class_name,''),'{esc(cls)}'), "
                     f"updated_at=CURRENT_TIMESTAMP WHERE id='{a['id']}';")
        emit_qna_by_name(nm)

    # new authors (6기): insert + submission + qna
    if newauthors:
        st = esc(args.student_type or "성적우수")
        L.append("-- new authors (insert + submission + qna)")
        for nm in newauthors:
            ident = people[nm]["parsed"]["identity"]
            hc = ident.get("hall_class", ""); hall = cls = ""
            if hc:
                parts = hc.split(None, 1); hall = parts[0]; cls = parts[1] if len(parts) > 1 else ""
            fn = esc(os.path.basename(people[nm]["path"]))
            L.append(f"INSERT INTO authors (name, cohort, student_type, hall, class_name) "
                     f"SELECT '{esc(nm)}',{coh},'{st}','{esc(hall)}','{esc(cls)}' "
                     f"WHERE NOT EXISTS (SELECT 1 FROM authors WHERE name='{esc(nm)}' AND cohort={coh});")
            L.append(f"INSERT INTO submissions (author_id, source_type, original_file_name, status) "
                     f"SELECT a.id,'hwp','{fn}','received' FROM authors a "
                     f"WHERE a.name='{esc(nm)}' AND a.cohort={coh} "
                     f"AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.author_id=a.id);")
            emit_qna_by_name(nm)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    open(args.out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"\nwrote {args.out}  ({len(L)} stmts, {len(qkeys)} questions)", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""최종원고 docx → 게재 꼭지(article) 레코드 파싱.

항해일지 최종원고 docx는 "Part 헤딩 → 항해일지 한마디 → (학생 헤더 → comment →
[몰입도 표] → 본문)*" 구조다. 이 스크립트는 그 구조를 그대로 레코드로 떠서
JSON으로 내보낸다. D1 적재는 load_articles.py가 맡는다(파싱과 적재를 분리해야
이름 매칭 실패를 적재 전에 확인할 수 있다).

  python3 scripts/parse_final_docx.py <docx폴더> [-o out/articles_parsed.json]

판형이 해마다 흔들려서 마커·헤더 인식은 전부 정규화 후 매칭한다.
  - 마커: [항해일지 한마디] / [항해일지 한 마디] / 항해일지 한마디 (대괄호 없음)
          [항해일지 Comment] / [항해일지 comment] / [항해일지팀 Comment]
  - 헤더: '황지형 / N관 S반 / 시대N 9기 성적우수자'
          '1. 곽민지 / 목동관 O반 / 시대인재N 9기 성적우수자 / 한양대 의예과'
          '백인겸/9기/N관 S(2)반/지구과학Ⅰ, 물리학Ⅱ/ 서울대 의예과, 국수탐 만점자'
          '이범석 / 8, 9기 / 신관 S반/ 물리학 Ⅱ, 지구과학 Ⅱ/2026학년도 수능 수석'
    → 슬래시 필드의 '순서'가 아니라 '내용'으로 종류를 판정한다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata as ud
import zipfile
from dataclasses import dataclass, field, asdict
from pathlib import Path

# ── 텍스트 유틸 ────────────────────────────────────────────────────────────

XML_ENTS = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'"}


def nfc(s: str) -> str:
    """macOS 파일명·docx 텍스트는 NFD로 오는 경우가 있다. D1은 NFC."""
    return ud.normalize("NFC", s)


def unescape(s: str) -> str:
    for k, v in XML_ENTS.items():
        s = s.replace(k, v)
    return s


def paragraphs(docx: Path) -> list[str]:
    """docx 본문 문단 텍스트. 서식 런이 쪼개져 있어 <w:t>를 문단 단위로 이어붙인다."""
    with zipfile.ZipFile(docx) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    out = []
    for p in re.findall(r"<w:p\b.*?</w:p>", xml, re.S):
        # `<w:t[^>]*>`로 쓰면 <w:tab w:val=.../>까지 걸려 XML 조각이 본문에 섞인다.
        # 태그명 뒤가 공백이거나 바로 닫히는 경우만 <w:t>로 인정한다.
        text = "".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p, re.S))
        out.append(nfc(unescape(text)).strip())
    return out


def norm_marker(s: str) -> str:
    """마커 비교용 정규화: 대괄호·공백·대소문자 제거."""
    return re.sub(r"[\[\]\s]", "", s).lower()


def strip_quotes(s: str) -> str:
    return s.strip().strip('“”"\'').strip()


def content_hash(body: str) -> str:
    """근사 중복 판정용. 공백·문장부호를 걷어낸 뒤 해시(SELECTION.md L2와 같은 규칙)."""
    norm = re.sub(r"[\s\W_]+", "", nfc(body))
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()


# ── 헤더 파싱 ─────────────────────────────────────────────────────────────

MONTHS = ["2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "수능"]

RE_HEADER = re.compile(
    r"^(?:[-–—•]\s*)?"           # '- ' 글머리(2호차 Part3·4 판형)
    r"(?:\d+[.)]\s*)?"           # '1. ' 같은 꼭지 번호(있을 수도 없을 수도)
    r"([가-힣]{2,4})\s*/"        # 이름
    r"(.+)$"                      # 나머지 슬래시 필드들
)
RE_COHORT = re.compile(r"(\d+(?:\s*,\s*\d+)*)\s*기")
RE_HALL = re.compile(r"(\S*관)\s*(\S+반)")
RE_UNIV = re.compile(r"(\S*(?:대학교|대))\s*(\S+과|\S+학부|\S+계열)?")
RE_SUBJECT = re.compile(r"(물리학|화학|생명과학|지구과학|미적분|기하|확률과\s*통계|사회문화|생활과\s*윤리|정치와\s*법|세계지리|한국지리|윤리와\s*사상|동아시아사|세계사|경제)")


@dataclass
class Piece:
    """게재 꼭지 1개 = articles 1행."""
    source_file: str
    source_order: int
    issue_label: str | None
    part_no: int | None
    chapter_no: int | None
    part_title: str | None
    section: str | None      # '(좌절 파트)' 같은 구획
    subtitle: str | None     # '소제목: …' 또는 '[국어]' 같은 과목 태그
    hanmadi: str | None
    author_name: str | None
    cohort: int | None
    cohorts_raw: str | None
    hall: str | None
    class_name: str | None
    subjects: str | None
    university: str | None
    epithet: str | None
    comment: str | None
    focus_json: str | None
    body: str = ""
    char_count: int = 0
    content_hash: str = ""
    header_raw: str = ""
    warnings: list[str] = field(default_factory=list)


def parse_header(line: str) -> dict | None:
    """학생 헤더 한 줄 → 필드. 슬래시 필드의 내용으로 종류를 판정한다."""
    m = RE_HEADER.match(line)
    if not m:
        return None
    name, rest = m.group(1), m.group(2)
    fields = [f.strip() for f in rest.split("/") if f.strip()]
    out: dict = {
        "author_name": name,
        "cohort": None,
        "cohorts_raw": None,
        "hall": None,
        "class_name": None,
        "subjects": None,
        "university": None,
        "epithet": None,
    }
    leftovers = []
    for f in fields:
        mc = RE_COHORT.search(f)
        mh = RE_HALL.search(f)
        if mh:
            out["hall"], out["class_name"] = mh.group(1), mh.group(2)
            # '시대N 9기 성적우수자'처럼 기수가 같은 필드에 섞여 오기도 한다.
            if mc and out["cohorts_raw"] is None:
                out["cohorts_raw"] = mc.group(1)
            continue
        if mc:
            out["cohorts_raw"] = mc.group(1)
            # '시대인재N 9기 성적우수자' → 트랙/수식어도 같이 들어있다.
            tail = RE_COHORT.sub("", f).replace("시대인재N", "").replace("시대N", "").strip()
            if tail:
                leftovers.append(tail)
            continue
        if RE_SUBJECT.search(f):
            out["subjects"] = f
            continue
        mu = RE_UNIV.search(f)
        if mu and ("대" in f):
            # '서울대 의예과, 국수탐 만점자'처럼 대학 뒤에 수식어가 붙기도 한다.
            parts = [p.strip() for p in f.split(",")]
            out["university"] = parts[0]
            if len(parts) > 1:
                leftovers.append(", ".join(parts[1:]))
            continue
        leftovers.append(f)
    # 기수도 관/반도 없으면 학생 헤더가 아니다. 인터뷰 문서의
    # '5. 수리/과학논술과 …' 같은 질문 줄이 헤더로 오인식되는 걸 막는다.
    if not out["cohorts_raw"] and not out["hall"]:
        return None
    if out["cohorts_raw"]:
        first = re.split(r"\s*,\s*", out["cohorts_raw"])[-1]  # '8, 9기' → 게재 기준은 마지막(9기)
        out["cohort"] = int(first)
    if leftovers:
        out["epithet"] = " / ".join(leftovers)
    return out


def parse_part_heading(paras: list[str]) -> tuple[int | None, int | None, str | None, int]:
    """앞부분에서 Part/Chapter 헤딩을 읽고, 본문 시작 인덱스를 돌려준다."""
    part_no = chapter_no = None
    title_bits: list[str] = []
    idx = 0
    for i, t in enumerate(paras[:8]):
        if not t:
            continue
        mp = re.match(r"^Part\s*(\d+)\s*[.\-]?\s*(.*)$", t, re.I)
        mc = re.match(r"^Chapter\s*(\d+)\s*[.\-]?\s*(.*)$", t, re.I)
        if mp:
            part_no = int(mp.group(1))
            if mp.group(2).strip():
                title_bits.append(mp.group(2).strip())
            idx = i + 1
        elif mc:
            chapter_no = int(mc.group(1))
            if mc.group(2).strip():
                title_bits.append(mc.group(2).strip())
            idx = i + 1
        elif part_no is not None and not title_bits:
            # 'Part 2.' 다음 줄에 제목만 오는 판형
            title_bits.append(t)
            idx = i + 1
            break
        elif part_no is not None:
            break
    return part_no, chapter_no, (" ".join(title_bits).strip() or None), idx


FOCUS_CELL = re.compile(r"^(\d{1,2}(-\d{1,2})?(월|시)|수능|[+-]?\d{1,2}|[-–—])$")
FOCUS_LABEL = re.compile(r"(월|시|수능)$")


def extract_focus(paras: list[str], i: int) -> tuple[str | None, int]:
    """공부몰입도 표를 통째로 걷어낸다.

    1년 몰입도는 월 라벨('2월'…'수능'), 하루 몰입도는 시간대 라벨('6-8시'…)이다.
    라벨 종류를 열거하지 말고 '짧은 표 셀이 연속으로 8개 이상'을 표로 본다 —
    처음엔 월 라벨만 인식하다가 하루 몰입도 표를 통째로 본문에 흘려보냈다.
    """
    j = i
    cells: list[str] = []
    while j < len(paras) and FOCUS_CELL.fullmatch(paras[j].replace(" ", "")):
        cells.append(paras[j].replace(" ", ""))
        j += 1
    if len(cells) < 8:
        return None, i
    keys = [c for c in cells if FOCUS_LABEL.search(c)]
    vals = [c for c in cells if not FOCUS_LABEL.search(c)]
    data = {k: (None if re.fullmatch(r"[-–—]", v) else int(v))
            for k, v in zip(keys, vals)} if keys else {}
    return json.dumps(data, ensure_ascii=False), j


def parse_docx(path: Path, issue_label: str | None) -> list[Piece]:
    paras = paragraphs(path)
    part_no, chapter_no, part_title, start = parse_part_heading(paras)
    if part_no is None:
        # 본문에 Part 헤딩이 없는 판형 → 파일명에서 읽는다.
        part_no, chapter_no_f, part_title_f = part_from_filename(path.name)
        chapter_no = chapter_no if chapter_no is not None else chapter_no_f
        part_title = part_title or part_title_f

    pieces: list[Piece] = []
    hanmadi: str | None = None
    section: str | None = None    # '(좌절 파트)' 구획
    subtitle: str | None = None   # '[국어]' 과목 태그 / '소제목: …'
    cur: Piece | None = None
    body: list[str] = []

    def flush():
        nonlocal cur, body
        if cur is None:
            return
        cur.body = "\n\n".join(b for b in body if b)
        cur.char_count = len(re.sub(r"\s", "", cur.body))
        cur.content_hash = content_hash(cur.body)
        if not cur.body:
            cur.warnings.append("본문 없음")
        if cur.cohort is None:
            cur.warnings.append("기수 미검출")
        pieces.append(cur)
        cur, body = None, []

    i = start
    while i < len(paras):
        t = paras[i]
        if not t:
            i += 1
            continue

        nm = norm_marker(t)

        # 과목/구간 태그: '[국어]' '[미적분]' — 다음 꼭지들의 subtitle이 된다.
        if re.fullmatch(r"\[[^\[\]]{1,12}\]", t) and "항해일지" not in t:
            subtitle = t.strip("[]").strip()
            i += 1
            continue

        # '(좌절 파트)' 구획 / '소제목: …' — 뒤따르는 꼭지들에 붙는다.
        if re.fullmatch(r"\([^()]{1,20}\)", t):
            section = t.strip("()").strip()
            i += 1
            continue
        ms = re.match(r"^소제목\s*[:：]\s*(.+)$", t)
        if ms:
            subtitle = ms.group(1).strip()
            i += 1
            continue

        # 한마디: 목차 단위 리드문. 마커 뒤 문단(또는 같은 문단 꼬리)에 온다.
        if nm.startswith("항해일지한마디") or nm.startswith("항해일지한마디"):
            tail = re.sub(r"^\[?항해일지\s*한\s*마디\]?", "", t).strip()
            if tail:
                hanmadi = strip_quotes(tail)
            elif i + 1 < len(paras):
                hanmadi = strip_quotes(paras[i + 1])
                i += 1
            i += 1
            continue

        # comment: 꼭지 단위. 반드시 학생 헤더 뒤에 온다.
        if nm.startswith("항해일지comment") or nm.startswith("항해일지팀comment"):
            tail = re.sub(r"^\[?항해일지팀?\s*comment\]?", "", t, flags=re.I).strip()
            val = None
            if tail:
                val = strip_quotes(tail)
            elif i + 1 < len(paras):
                val = strip_quotes(paras[i + 1])
                i += 1
            if cur is not None:
                cur.comment = val
            i += 1
            continue

        hdr = parse_header(t)
        if hdr:
            flush()
            cur = Piece(
                source_file=path.name,
                source_order=len(pieces) + 1,
                issue_label=issue_label,
                part_no=part_no,
                chapter_no=chapter_no,
                part_title=part_title,
                section=section,
                subtitle=subtitle,
                hanmadi=hanmadi,
                comment=None,
                focus_json=None,
                header_raw=t,
                **{k: hdr[k] for k in (
                    "author_name", "cohort", "cohorts_raw", "hall",
                    "class_name", "subjects", "university", "epithet")},
            )
            i += 1
            continue

        # 공부몰입도 표
        focus, j = extract_focus(paras, i)
        if focus is not None:
            if cur is not None:
                cur.focus_json = focus
            i = j
            continue

        # 그 외는 본문. 헤더 이전에 나오는 안내문(*공부몰입도란? 등)은 버린다.
        if cur is not None:
            body.append(t)
        i += 1

    flush()
    return pieces


# ── 호차 라벨 추론 ────────────────────────────────────────────────────────

def guess_issue_label(name: str) -> str | None:
    """파일명에서 호차를 읽는다. '[항1]' → 1호차, '[2027항2]' → 2027 2호차."""
    n = nfc(name)
    m = re.search(r"\[(?:(\d{4}))?\s*항(?:해일지)?\s*(\d+)\]", n)
    if m:
        year, no = m.group(1), m.group(2)
        return f"{year} 항해일지 {no}호차" if year else f"항해일지 {no}호차"
    m = re.search(r"\[항해일지\s*(\d+)호차\]", n)
    if m:
        return f"항해일지 {m.group(1)}호차"
    m = re.search(r"(\d{4})\s*항해일지[_ ]*(\d+)호", n)
    if m:
        return f"{m.group(1)} 항해일지 {m.group(2)}호차"
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", help="최종원고 docx가 있는 폴더")
    ap.add_argument("-o", "--out", default="out/articles_parsed.json")
    ap.add_argument("--issue", default=None, help="호차 라벨 강제 지정")
    args = ap.parse_args()

    folder = Path(args.folder).expanduser()
    files = sorted(p for p in folder.rglob("*.docx") if not p.name.startswith("~$"))
    if not files:
        print(f"docx 없음: {folder}", file=sys.stderr)
        return 1

    all_pieces: list[Piece] = []
    print(f"{'파일':<58}{'호차':<18}{'꼭지':>5}{'경고':>5}")
    print("-" * 88)
    for f in files:
        label = args.issue or guess_issue_label(f.name)
        try:
            pieces = parse_docx(f, label)
        except Exception as e:  # 판형이 다른 파일은 건너뛰고 리포트에 남긴다
            print(f"{f.name[:56]:<58}{'ERROR':<18}{'-':>5}  {e}")
            continue
        warn = sum(1 for p in pieces if p.warnings)
        print(f"{f.name[:56]:<58}{(label or '?'):<18}{len(pieces):>5}{warn:>5}")
        all_pieces.extend(pieces)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps([asdict(p) for p in all_pieces], ensure_ascii=False, indent=1))
    print("-" * 88)
    print(f"총 {len(all_pieces)} 꼭지 → {out}")

    no_body = [p for p in all_pieces if not p.body]
    no_cohort = [p for p in all_pieces if p.cohort is None]
    dup = {}
    for p in all_pieces:
        dup.setdefault(p.content_hash, []).append(p)
    dups = [v for v in dup.values() if len(v) > 1 and v[0].body]
    print(f"본문 없음 {len(no_body)} · 기수 미검출 {len(no_cohort)} · 파일 내 중복 {len(dups)}")
    for p in no_body[:5]:
        print(f"  [본문없음] {p.source_file} #{p.source_order} {p.header_raw[:50]}")
    for p in no_cohort[:5]:
        print(f"  [기수없음] {p.source_file} #{p.source_order} {p.header_raw[:50]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

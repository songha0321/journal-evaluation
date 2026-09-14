#!/usr/bin/env python3
"""역대 항해일지 인쇄본 PDF → 게재 꼭지(article) 레코드 파싱.

parse_final_docx.py와 같은 JSON 스키마를 낸다 → load_articles.py가 그대로 받는다.

  python3 scripts/parse_print_pdf.py archive/print/*.pdf -o out/articles_pdf.json

설계 메모: 처음엔 연도별 판형 프로파일로 짰다가 버렸다. 판형은 파일 단위가 아니라
**꼭지 단위**로 바뀐다 — 2026 5호차 한 권 안에서만 저자 표기가 3가지다.
그래서 연도 분기 없이, 모든 판형을 한꺼번에 인식하는 방식으로 되돌렸다.

인식하는 저자 표기(실제 수집된 형태):
    이우영 · N관 S반 · 시대인재N 8기 성적우수자
    박진혁 · N관 W반            (+ 다음 줄 '시대N 8기 성적우수자')
    이소윤 / N관 O반 / 8기 성적우수자
    박진혁 (N관 W반, 8기 성적우수자)      정예림 (W관 O반 | 8기 성적우수자)
    7, 8기 | S관 S반 | 화학 Ⅰ, 생명과학 Ⅰ   (이름은 위쪽 줄)
    브릿지관 D반–시대N 5기                  (이름·대학은 위쪽 줄, 2023 판형)

공통점은 '관 + 반'이 한 줄에 있다는 것. 그 줄을 앵커로 잡고 이름·기수·트랙을
줄 안에서, 없으면 앞뒤 줄에서 찾는다.

한계(적재 전에 알고 있어야 함): 인쇄 PDF는 줄바꿈에서 공백이 사라진다. 한국어는
어절 중간에서도 줄이 바뀌어(‘완전/히’) 공백 복원이 원리적으로 불가능하다. 그래서
본문은 공백 없이 이어 붙인다. content_hash는 공백을 무시하므로 docx 출처 본문과
중복 판정은 정상 동작하고, 같은 글이 docx로도 있으면 그쪽 본문이 정본으로 남는다.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import subprocess
import unicodedata as ud
from dataclasses import dataclass, field, asdict
from pathlib import Path


def nfc(s: str) -> str:
    return ud.normalize("NFC", s)


def content_hash(body: str) -> str:
    return hashlib.sha1(re.sub(r"[\s\W_]+", "", nfc(body)).encode()).hexdigest()


@dataclass
class Line:
    page: int
    half: int
    x0: float
    x1: float
    y: float
    text: str

    @property
    def width(self) -> float:
        return self.x1 - self.x0


@dataclass
class Piece:
    source_file: str
    source_order: int
    issue_label: str | None
    part_no: int | None
    chapter_no: int | None
    part_title: str | None
    section: str | None
    subtitle: str | None
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
    source_page: int | None = None
    body: str = ""
    char_count: int = 0
    content_hash: str = ""
    header_raw: str = ""
    warnings: list[str] = field(default_factory=list)


# ── PDF → 라인 ────────────────────────────────────────────────────────────

FURNITURE = re.compile(r"^\d{4}/\d{1,2}/\d{1,2}|^Part\s*\d+$|^\d{1,3}$")
# 인쇄용 슬러그(파일명.indd + 쪽번호)와 러닝헤더. 슬러그는 앞쪽 글자가 깨져 나오는
# 경우가 많아 앞에서부터 매칭하면 안 되고 포함 여부로 봐야 한다.
FURNITURE_ANY = re.compile(r"\.indd|^SDIJ\s*N?\s*항해일지$|^항해일지\s*航海日誌$")


def read_lines(pdf: Path, spread: bool) -> list[Line]:
    xml = subprocess.run(["pdftotext", "-bbox-layout", str(pdf), "-"],
                         capture_output=True, text=True).stdout
    out: list[Line] = []
    for pno, page in enumerate(re.findall(r"<page\b.*?</page>", xml, re.S), start=1):
        pw = float(re.search(r'width="([\d.]+)"', page).group(1))
        for ln in re.findall(r"<line\b[^>]*>.*?</line>", page, re.S):
            tag = re.match(r"<line([^>]*)>", ln).group(1)
            at = dict(re.findall(r'(\w+)="([\d.]+)"', tag))
            if not {"xMin", "xMax", "yMin"} <= at.keys():
                continue
            words = [html.unescape(w) for w in re.findall(r"<word[^>]*>(.*?)</word>", ln)]
            text = nfc(" ".join(words)).strip()
            if not text or FURNITURE.match(text) or FURNITURE_ANY.search(text):
                continue
            x0, x1, y = float(at["xMin"]), float(at["xMax"]), float(at["yMin"])
            out.append(Line(pno, 1 if (spread and x0 > pw / 2) else 0, x0, x1, y, text))
    return out


def join_body(lines: list[Line]) -> str:
    """시각적 줄 → 문단. y 간격이 벌어지면 문단 경계로 본다."""
    if not lines:
        return ""
    ordered = sorted(lines, key=lambda l: (l.page, l.half, l.y, l.x0))
    gaps = [b.y - a.y for a, b in zip(ordered, ordered[1:])
            if a.page == b.page and a.half == b.half and 0 < b.y - a.y < 100]
    base = sorted(gaps)[len(gaps) // 2] if gaps else 16.0
    paras: list[list[str]] = [[ordered[0].text]]
    for prev, cur in zip(ordered, ordered[1:]):
        same = prev.page == cur.page and prev.half == cur.half
        if (not same) or cur.y - prev.y > base * 1.5 or cur.y < prev.y:
            paras.append([cur.text])
        else:
            paras[-1].append(cur.text)
    out = []
    for p in paras:
        s = p[0]
        for nxt in p[1:]:
            sep = " " if re.search(r"[A-Za-z0-9]$", s) and re.match(r"[A-Za-z0-9]", nxt) else ""
            s += sep + nxt
        out.append(s.strip())
    return "\n\n".join(x for x in out if x)


# ── 저자 앵커 인식 ────────────────────────────────────────────────────────

RE_SOSOK = re.compile(r"(?P<hall>[가-힣A-Z0-9]*관)\s*(?:[가-힣A-Z0-9]+\s+)?(?P<cls>[가-힣A-Z0-9()]+반)")
RE_COHORT = re.compile(r"(?P<raw>\d+(?:\s*[,·•]\s*\d+)*)\s*기")
RE_NAME_INLINE = re.compile(r"^(?:[^,]{0,12},\s*)?(?P<name>[가-힣]{2,4})\s*(?:[·・•∙/(]|\s[|｜])")
RE_NAME_ONLY = re.compile(r"^[가-힣]{2,4}$")
# 이름 자리에 오는 신분·구분 표기. '재수 | 브릿지관 D반 | 시대N 5기'처럼 생겨서
# 그대로 두면 이름으로 잡히고, 진짜 이름(윗줄)을 놓친다.
NOT_A_NAME = {"재수", "삼반수", "사반수", "반수", "현역", "재종", "졸업생",
              "정시", "수시", "논술", "면접", "수능", "우수자", "인문", "자연"}
RE_UNIV = re.compile(r"^\S*(?:대|대학교)\s?\S*(?:과|학부|계열|학과)?$")
RE_TRACK = re.compile(r"(성적우수자?|성적향상자?|우선선발|포레스트|졸업생)")
RE_COMMENT = re.compile(r"^항해일지팀?\s*comment", re.I)
RE_HANMADI = re.compile(r"^항해일지\s*팀?의?\s*한\s*마디")
RE_PART = re.compile(r"^Part\s*(\d+)(?:[.\-](\d+))?\s*\.?\s*(.*)$", re.I)

# 몰입도 그래프 축·시간표 격자처럼 조판 그래픽에서 흘러나온 텍스트. 본문에 섞이면
# 문장이 깨지므로 버린다(수치 자체는 게재 원고의 본문이 아니다).
RE_NOISE = re.compile(
    r"^([+\-–]?\d+([+\-–]?\d+)*|\d{1,2}(월|시|교시)|수능|\d{2}:\d{2}([-~]\d{2}:\d{2})?"
    r"|[월화수목금토일]{2,7}|\d+\s*교시.*|점심식사|저녁식사|기상|취침)$")


RE_AXIS_TOKEN = re.compile(r"^(\d{1,2}(-\d{1,2})?(월|시|교시)|수능|[+-]?\d{1,2}|[월화수목금토일])$")


def is_noise(text: str) -> bool:
    t = text.replace(" ", "")
    if RE_NOISE.match(t) or (len(t) <= 4 and not re.search(r"[가-힣]{2,}", t)):
        return True
    # OCR은 그래프 축 라벨을 한 줄로 합쳐 낸다: '2월 3월 4월 … 수능'
    toks = text.split()
    if len(toks) >= 4 and sum(bool(RE_AXIS_TOKEN.match(x)) for x in toks) >= len(toks) * 0.8:
        return True
    return False


def cohort_last(raw: str | None) -> int | None:
    """'7, 8기' → 8 (게재 기준은 마지막 기수).

    OCR이 '4•5기'의 가운뎃점을 흘려 '45기'로 읽는 경우가 있다. 기수는 한 자리
    범위라 두 자리 이상이면 마지막 자리만 취한다.
    """
    nums = re.findall(r"\d+", raw or "")
    if not nums:
        return None
    n = int(nums[-1])
    return int(str(n)[-1]) if n > 15 else n


def issue_from_filename(name: str) -> tuple[str | None, int | None]:
    n = nfc(name)
    my = re.search(r"(\d{4})", n)
    year = int(my.group(1)) if my else None
    if re.search(r"[Ff]inal", n):
        ho = "Final호차"
    else:
        mh = re.search(r"(\d+(?:\.\d+)?)\s*호", n)
        ho = f"{mh.group(1)}호차" if mh else None
    return (f"{year} 항해일지 {ho}" if year and ho else None), (year - 2018 if year else None)


def is_anchor(ln: Line) -> re.Match | None:
    """'관 + 반'이 들어간 짧은 줄 = 저자 표기 줄."""
    if len(ln.text) > 60:
        return None
    m = RE_SOSOK.search(ln.text)
    if not m:
        return None
    # '3관 O반, 8기' 처럼 소속 표기는 항상 짧다. 본문 문장은 배제한다.
    if re.search(r"(습니다|합니다|입니다|했다|바랍니다)", ln.text):
        return None
    return m


def parse_pdf(pdf: Path) -> list[Piece]:
    spread = "2p씩" in nfc(pdf.name)
    return assemble(read_lines(pdf, spread), nfc(pdf.name))


def assemble(lines: list[Line], source_name: str) -> list[Piece]:
    """라인 목록 → 꼭지. OCR 경로(ocr_print_pdf.py)도 이 함수를 그대로 쓴다."""
    label, file_cohort = issue_from_filename(source_name)
    if not lines:
        return []
    pdf = Path(source_name)
    ordered = sorted(lines, key=lambda l: (l.page, l.half, l.y, l.x0))
    maxw = max(l.width for l in ordered)

    # 1) comment / 한마디 블록을 먼저 걷어낸다(본문 단과 섞이면 문단이 깨진다).
    consumed: set[int] = set()
    comments: list[tuple[int, int, float, str]] = []   # (page, half, y, text)
    hanmadis: list[tuple[int, int, float, str]] = []
    for i, ln in enumerate(ordered):
        marker = RE_COMMENT.match(ln.text) or RE_HANMADI.match(ln.text)
        if not marker:
            continue
        is_cm = bool(RE_COMMENT.match(ln.text))
        consumed.add(i)
        buf: list[str] = []
        tail = re.sub(r"^항해일지\s*팀?의?\s*(comment|한\s*마디)\s*[:：]?", "", ln.text, flags=re.I).strip()
        if tail:
            buf.append(tail)
        # comment 단과 본문 단은 y가 서로 엇갈려 있다(같은 높이에서 나란히 흐른다).
        # 읽기 순서대로 훑으면 본문 한 줄에 바로 끊기므로, 같은 x(같은 단)만 따라간다.
        last_y = ln.y
        for j in range(i + 1, min(i + 60, len(ordered))):
            nx = ordered[j]
            if nx.page != ln.page or nx.half != ln.half:
                break
            if abs(nx.x0 - ln.x0) > 25:
                continue                      # 옆 단(본문) — 건너뛴다
            if is_anchor(nx) or RE_COMMENT.match(nx.text) or RE_HANMADI.match(nx.text):
                break
            if nx.y - last_y > 40 and buf:    # 같은 단이라도 멀리 떨어지면 다른 블록
                break
            if nx.width > maxw * 0.75 and buf:
                break
            if "Noun Project" in nx.text or nx.text.startswith("Created by"):
                consumed.add(j)
                continue
            buf.append(nx.text)
            consumed.add(j)
            last_y = nx.y
        text = "".join(buf).strip()
        if text:
            (comments if is_cm else hanmadis).append((ln.page, ln.half, ln.y, text))

    # 2) Part 헤딩. 목차 페이지(Part 줄이 3개 이상인 페이지)는 버린다.
    part_of_page: dict[int, tuple[int | None, int | None, str | None]] = {}
    for pno in sorted({l.page for l in ordered}):
        page = [l for l in ordered if l.page == pno]
        marks = [l for l in page if RE_PART.match(l.text) and len(l.text) < 40]
        if not marks or len(marks) > 2:
            continue
        m = RE_PART.match(marks[0].text)
        title = (m.group(3) or "").strip()
        if not title:
            after = [l for l in page if l.y > marks[0].y and 1 < len(l.text) < 30
                     and re.search(r"[가-힣]{2,}", l.text)]
            title = after[0].text if after else ""
        part_of_page[pno] = (int(m.group(1)),
                             int(m.group(2)) if m.group(2) else None,
                             title or None)

    def part_at(pno: int):
        seen = [p for p in sorted(part_of_page) if p <= pno]
        return part_of_page[seen[-1]] if seen else (None, None, None)

    def hanmadi_at(ln: Line) -> str | None:
        prior = [h for h in hanmadis
                 if (h[0], h[1], h[2]) <= (ln.page, ln.half, ln.y)]
        return prior[-1][3] if prior else None

    # 3) 앵커 → 꼭지
    pieces: list[Piece] = []
    cur: Piece | None = None
    buf: list[Line] = []

    def flush():
        nonlocal cur, buf
        if cur is None:
            return
        cur.body = join_body(buf)
        cur.char_count = len(re.sub(r"\s", "", cur.body))
        cur.content_hash = content_hash(cur.body)
        if not cur.body:
            cur.warnings.append("본문 없음")
        if not cur.author_name:
            cur.warnings.append("작성자 미검출")
        if cur.cohort is None:
            cur.warnings.append("기수 미검출")
        pieces.append(cur)
        cur, buf = None, []

    for i, ln in enumerate(ordered):
        if i in consumed:
            continue
        if RE_PART.match(ln.text) and len(ln.text) < 40:
            continue
        m = is_anchor(ln)
        if not m:
            if cur is not None and not is_noise(ln.text):
                buf.append(ln)
            continue

        flush()
        p_no, c_no, p_title = part_at(ln.page)
        cur = Piece(source_file=nfc(pdf.name), source_order=len(pieces) + 1,
                    issue_label=label, part_no=p_no, chapter_no=c_no, part_title=p_title,
                    section=None, subtitle=None, hanmadi=hanmadi_at(ln),
                    author_name=None, cohort=None, cohorts_raw=None,
                    hall=m["hall"], class_name=m["cls"], subjects=None,
                    university=None, epithet=None, comment=None, focus_json=None,
                    source_page=ln.page, header_raw=ln.text)

        mn = RE_NAME_INLINE.match(ln.text)
        if mn and mn["name"] not in NOT_A_NAME:
            cur.author_name = mn["name"]
        mc = RE_COHORT.search(ln.text)
        if not mc:      # '박진혁 · N관 W반' 다음 줄에 '시대N 8기 성적우수자'
            for j in range(i + 1, min(i + 3, len(ordered))):
                if ordered[j].page != ln.page:
                    break
                mc = RE_COHORT.search(ordered[j].text)
                if mc:
                    consumed.add(j)
                    if not cur.epithet:
                        t = RE_TRACK.search(ordered[j].text)
                        cur.epithet = t.group(1) if t else None
                    break
        if mc:
            cur.cohorts_raw, cur.cohort = mc["raw"], cohort_last(mc["raw"])
        if not cur.epithet:
            t = RE_TRACK.search(ln.text)
            cur.epithet = t.group(1) if t else None

        # 이름이 줄 안에 없는 판형 → 바로 위 줄들에서 이름/대학/수식어를 찾는다.
        if not cur.author_name:
            for j in range(max(0, i - 12), i):
                t = ordered[j].text
                if ordered[j].page != ln.page or ordered[j].half != ln.half:
                    continue
                if len(t) > 40:      # 본문 줄은 건너뛴다
                    continue
                if RE_NAME_ONLY.fullmatch(t) and t not in NOT_A_NAME:
                    cur.author_name = t
                    consumed.add(j)
                    if buf and buf[-1] is ordered[j]:
                        buf.pop()
                elif RE_UNIV.match(t) and not cur.university:
                    cur.university = t
                    consumed.add(j)
                elif not cur.epithet and 4 < len(t) < 40 and not RE_SOSOK.search(t):
                    cur.epithet = t

        # 이름이 앵커 아래에 놓이는 판형도 있다(2023 Final: '시대N 5기Ⅰ신관 S반' / 그 아래 '홍수연').
        if not cur.author_name:
            for j in range(i + 1, min(i + 6, len(ordered))):
                nx = ordered[j]
                if nx.page != ln.page or nx.half != ln.half or nx.y - ln.y > 45:
                    break
                if RE_NAME_ONLY.fullmatch(nx.text) and nx.text not in NOT_A_NAME:
                    cur.author_name = nx.text
                    consumed.add(j)
                    break
                if RE_UNIV.match(nx.text) and not cur.university:
                    cur.university = nx.text
                    consumed.add(j)

        rest = ln.text[m.end():]
        subj = re.search(r"[|｜/]\s*([^|｜/]*(?:물리|화학|생명|지구|미적|기하|확률|사회|생활|정치|지리|윤리|역사|경제)[^|｜/]*)$", rest)
        if subj:
            cur.subjects = subj.group(1).strip()

        near = [c for c in comments if c[0] == ln.page and c[1] == ln.half and c[2] >= ln.y - 60]
        if near:
            cur.comment = min(near, key=lambda c: c[2])[3]

    flush()
    for p in pieces:
        if p.cohort is None:
            p.cohort = file_cohort
            if "기수 미검출" in p.warnings:
                p.warnings.remove("기수 미검출")
                p.warnings.append("기수=파일명 추정")
    return pieces


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("-o", "--out", default="out/articles_pdf.json")
    args = ap.parse_args()

    all_pieces: list[Piece] = []
    print(f"{'파일':<46}{'호차':<20}{'꼭지':>5}{'평균자수':>7}{'경고':>5}")
    print("-" * 85)
    for f in sorted(Path(p) for p in args.pdfs):
        pieces = parse_pdf(f)
        label = pieces[0].issue_label if pieces else issue_from_filename(f.name)[0]
        warn = sum(1 for p in pieces if p.warnings)
        avg = sum(p.char_count for p in pieces) // max(len(pieces), 1)
        print(f"{nfc(f.name)[:44]:<46}{(label or '?'):<20}{len(pieces):>5}{avg:>7}{warn:>5}")
        all_pieces.extend(pieces)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps([asdict(p) for p in all_pieces], ensure_ascii=False, indent=1))
    print("-" * 85)
    print(f"총 {len(all_pieces)} 꼭지 → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

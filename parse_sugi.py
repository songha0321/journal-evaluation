# -*- coding: utf-8 -*-
"""
수기 답안지 본문 파서 — 5기(A1~C3) / 6기([N], [N-M]) 두 템플릿을 질문별로 분해.

parse_manuscript(text, cohort) -> {
    "identity": {label: value, ...},       # 기본 인적사항
    "segments": [(key, header, body), ...], # 질문별 (키, 헤더, 본문(raw))
}

본문(body)에는 템플릿 가이드(작성용 키워드/※안내 등)가 섞여 있을 수 있다.
가이드는 학생마다 동일하므로, 배치 실행 시 build_boilerplate() 로 질문키별 빈출
라인을 추려 strip_boilerplate() 로 제거한다(빈도 기반).
"""
import re
from collections import Counter, defaultdict

# 5기: 'A1. ...', 섹션 'A. 시기별 질문 (A1~A9)'
RE_5_Q = re.compile(r"^([ABC])(\d+)\.\s*(.*)$")
RE_5_SEC = re.compile(r"^([ABC])\.\s*(.+질문.*)$")
# 6기: '[1-1] ...', '[2] ...'  — ']' 뒤에 공백 필수 (가이드 줄 '[3-1]과 ...' 오인 방지)
RE_6_Q = re.compile(r"^\[(\d+(?:-\d+)?)\]\s+(\S.*)$")

SECTION_CATEGORY_5 = {"A": "시기별", "B": "주제별", "C": "선택"}


def _is_marker(line, cohort):
    s = line.strip()
    if cohort == 5:
        m = RE_5_Q.match(s)
        if m:
            return ("Q", f"{m.group(1)}{m.group(2)}", s)
        m = RE_5_SEC.match(s)
        if m:
            return ("SEC", m.group(1), s)
    else:
        m = RE_6_Q.match(s)
        if m:
            return ("Q", m.group(1), s)
    return None


def parse_manuscript(text, cohort):
    lines = text.splitlines()
    # find first question marker; everything before = identity region
    first = None
    for i, ln in enumerate(lines):
        mk = _is_marker(ln, cohort)
        if mk and mk[0] == "Q":
            first = i
            break
    identity = parse_identity(lines[: first if first is not None else len(lines)])

    segments = []
    cur_key = cur_header = cur_seg_cat = None
    section_cat = None          # most recent section (set even before first Q)
    buf = []

    def flush():
        if cur_key is not None:
            body = "\n".join(buf).strip()
            segments.append((cur_key, cur_header, body, cur_seg_cat))

    if first is None:
        return {"identity": identity, "segments": []}

    for ln in lines:
        mk = _is_marker(ln, cohort)
        if mk and mk[0] == "SEC":
            flush()                                   # close prior seg with its own category
            cur_key = None
            section_cat = SECTION_CATEGORY_5.get(mk[1])
            continue
        if mk and mk[0] == "Q":
            flush()
            cur_key, cur_header, cur_seg_cat = mk[1], mk[2], section_cat
            buf = []
        elif cur_key is not None:
            buf.append(ln)
    flush()
    return {"identity": identity, "segments": segments}


# ---------- 기본 인적사항 ----------
IDENTITY_LABELS = {
    "이름": "name",
    "나이(생년)": "birth", "나이": "birth",
    "소속 관&반": "hall_class", "소속 관 반": "hall_class", "소속관반": "hall_class",
    "N수 경력": "nsu", "n수 경력": "nsu",
    "시대N 재원기수": "cohort_label", "시대N 재원 기수": "cohort_label",
    "학원 등원 방식": "commute",
    "수시 지원 여부": "susi",
    "최종 진학 대학": "final_univ", "최종대학": "final_univ", "최종 합격 대학": "final_univ",
}


def parse_identity(lines):
    out = {}
    for i, l in enumerate(lines):
        key = IDENTITY_LABELS.get(l.strip())
        if not key or key in out:
            continue
        for j in range(i + 1, min(i + 4, len(lines))):
            v = lines[j].strip()
            if not v or v.startswith("*") or v in IDENTITY_LABELS:
                continue
            out[key] = v
            break
    return out


# ---------- 빈도 기반 가이드(boilerplate) 제거 ----------
def build_boilerplate(all_parsed, min_count=3, min_ratio=0.25):
    """질문키별로, 여러 학생 본문에 공통 등장하는 라인 = 템플릿 가이드.

    all_parsed: list of parse_manuscript() 결과
    return: {key: set(boilerplate_line)}
    """
    per_key_lines = defaultdict(list)   # key -> list of (student's set of lines)
    for p in all_parsed:
        for key, header, body, cat in p["segments"]:
            lines = {ln.strip() for ln in body.splitlines() if ln.strip()}
            per_key_lines[key].append(lines)
    boiler = {}
    for key, students in per_key_lines.items():
        n = len(students)
        cnt = Counter()
        for s in students:
            cnt.update(s)
        thr = max(min_count, int(n * min_ratio))
        boiler[key] = {ln for ln, c in cnt.items() if c >= thr}
    return boiler


_GUIDE_HINTS = ("작성용 키워드", "아래 키워드", "키워드를 참고", "선택하여 답변",
                "해당 셀을 삭제", "해당하는 것만", "구글폼에", "복사", "내용)")


def strip_boilerplate(body, boiler_set):
    out = []
    for ln in body.splitlines():
        s = ln.strip()
        if not s:
            continue
        if s in boiler_set:
            continue
        if s.startswith("※") or s.startswith("*"):
            continue
        if any(h in s for h in _GUIDE_HINTS):
            continue
        out.append(s)
    return "\n".join(out).strip()

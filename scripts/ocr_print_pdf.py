#!/usr/bin/env python3
"""텍스트가 윤곽선으로 변환된 인쇄본 PDF → OCR → 게재 꼭지 파싱.

pdftotext가 0자를 뱉는 12권(2023 1·2·4호, 2025 1호, 2026 1·3호차 등)을 위한 경로다.
페이지를 300dpi PNG로 렌더 → macOS Vision OCR(scripts/ocr_page.swift) → 좌표가 붙은
라인 → parse_print_pdf.assemble()로 꼭지 조립. 조립 로직은 텍스트 PDF와 완전히 공유한다.

  swiftc -O scripts/ocr_page.swift -o out/ocr_page          # 1회
  python3 scripts/ocr_print_pdf.py archive/print/*.pdf -o out/articles_ocr.json

디스크 여유가 적어(1~3GB) 페이지 PNG는 한 장씩 만들고 바로 지운다.
캐시(--cache)에 페이지별 OCR 결과를 JSON으로 남겨 두면 재파싱은 렌더 없이 즉시 끝난다.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
import unicodedata as ud
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from parse_print_pdf import Line, assemble, nfc  # noqa: E402

OCR_BIN = Path("out/ocr_page")


def page_count(pdf: Path) -> int:
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
    return int(re.search(r"Pages:\s+(\d+)", info).group(1))


def ocr_page(pdf: Path, page: int, dpi: int, tmp: Path) -> list[dict]:
    """한 페이지를 렌더 → OCR → [{text,x,y,w,h}] (좌표는 0~1 정규화, y는 아래가 0)."""
    stem = tmp / "pg"
    subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page),
                    "-png", str(pdf), str(stem)], check=True, capture_output=True)
    pngs = sorted(tmp.glob("pg-*.png")) + sorted(tmp.glob("pg*.png"))
    if not pngs:
        return []
    png = pngs[0]
    try:
        out = subprocess.run([str(OCR_BIN), str(png), "--json"],
                             capture_output=True, text=True, check=True).stdout
        return json.loads(out) if out.strip() else []
    finally:
        for p in pngs:
            p.unlink(missing_ok=True)


def to_lines(raw: list[dict], page: int, spread: bool) -> list[Line]:
    """Vision 좌표(좌하단 원점, 0~1) → parse_print_pdf의 Line(좌상단 원점, 포인트 유사 단위).

    조립 로직은 상대 좌표만 쓰므로 1000 스케일로 옮기면 그대로 통한다.
    """
    out: list[Line] = []
    for r in raw:
        text = nfc(str(r.get("text", "")).strip())
        if not text:
            continue
        x0 = float(r["x"]) * 1000
        x1 = (float(r["x"]) + float(r["w"])) * 1000
        y = (1.0 - float(r["y"]) - float(r["h"])) * 1000     # 위에서부터의 거리
        out.append(Line(page, 1 if (spread and x0 > 500) else 0, x0, x1, y, text))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("-o", "--out", default="out/articles_ocr.json")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--cache", default="out/ocr-cache")
    args = ap.parse_args()

    if not OCR_BIN.exists():
        print(f"{OCR_BIN} 없음 → swiftc -O scripts/ocr_page.swift -o {OCR_BIN}", file=sys.stderr)
        return 2

    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    all_pieces = []

    for pdf in sorted(Path(p) for p in args.pdfs):
        name = nfc(pdf.name)
        spread = "2p씩" in name
        n = page_count(pdf)
        cache_file = cache / (re.sub(r"[^\w.-]", "_", name) + ".json")
        if cache_file.exists():
            pages = json.loads(cache_file.read_text())
            print(f"[캐시] {name[:44]} {n}p", file=sys.stderr)
        else:
            pages = {}
            t0 = time.time()
            with tempfile.TemporaryDirectory() as td:
                for p in range(1, n + 1):
                    pages[str(p)] = ocr_page(pdf, p, args.dpi, Path(td))
                    done = p / n
                    eta = (time.time() - t0) / max(done, 1e-9) * (1 - done)
                    print(f"\r[OCR] {name[:34]:<36} {p:>3}/{n}  남은 {eta/60:4.1f}분",
                          end="", file=sys.stderr, flush=True)
            print(file=sys.stderr)
            cache_file.write_text(json.dumps(pages, ensure_ascii=False))

        lines: list[Line] = []
        for p_str, raw in sorted(pages.items(), key=lambda kv: int(kv[0])):
            lines.extend(to_lines(raw, int(p_str), spread))
        pieces = assemble(lines, name)
        chars = sum(p.char_count for p in pieces)
        print(f"  → 꼭지 {len(pieces)} · 총 {chars:,}자 · 이름 "
              f"{sum(1 for p in pieces if p.author_name)}", file=sys.stderr)
        all_pieces.extend(pieces)

    from dataclasses import asdict
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps([asdict(p) for p in all_pieces], ensure_ascii=False, indent=1))
    print(f"총 {len(all_pieces)} 꼭지 → {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

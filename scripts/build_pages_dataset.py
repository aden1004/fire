"""Build the page-viewer dataset for the 2025 book.

For Option B (page-image viewer + minimal metadata), we don't transcribe
question content. We only record:
- chunk + position
- book page marker (e.g. "25-15") derived from chunk layout
- round (1/2/3) and approximate subject range (1-4)
- whether the page is a cover/title page
- mnemonic keywords harvested from the OCR text (single keywords only, no tip text)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "public" / "pages" / "2025"
OCR_PATH = ROOT / "data" / "raw" / "2025" / "2025_ocr.txt"
OUT_PATH = ROOT / "data" / "normalized" / "2025_pages.json"

# Verified by inspecting one sample page per chunk.
# Each entry: (chunk_no, first_book_page, last_book_page, has_cover_at_start)
# - Round 1 covers all of part01-02 (book pages 25-2..25-27); part01_p01 is the front cover.
# - Round 2 starts at part03_p01 (25-28) with its own title bar on that page (not a separate cover).
# - Round 3 starts at part05_p01 (25-56) the same way.
CHUNK_LAYOUT = [
    {"chunk": 1, "pages_in_chunk": 14, "first_book": 2,  "last_book": 14, "cover_first": True,  "round": 1},
    {"chunk": 2, "pages_in_chunk": 13, "first_book": 15, "last_book": 27, "cover_first": False, "round": 1},
    {"chunk": 3, "pages_in_chunk": 14, "first_book": 28, "last_book": 41, "cover_first": False, "round": 2},
    {"chunk": 4, "pages_in_chunk": 14, "first_book": 42, "last_book": 55, "cover_first": False, "round": 2},
    {"chunk": 5, "pages_in_chunk": 14, "first_book": 56, "last_book": 69, "cover_first": False, "round": 3},
    {"chunk": 6, "pages_in_chunk": 13, "first_book": 70, "last_book": 82, "cover_first": False, "round": 3},
    {"chunk": 7, "pages_in_chunk": 2,  "first_book": 83, "last_book": 84, "cover_first": False, "round": 3},
]

ROUND_INFO = {
    1: {"date": "2025.2.7",  "footer_code": "02", "first_page": 2,  "last_page": 27},
    2: {"date": "2025.5.21", "footer_code": "05", "first_page": 28, "last_page": 55},
    3: {"date": "2025.9.1",  "footer_code": "09", "first_page": 56, "last_page": 84},
}

SUBJECTS = {
    1: "소방원론",
    2: "소방전기일반",
    3: "소방관계법규",
    4: "소방전기시설의 구조 및 원리",
}


def approximate_subject(round_no: int, book_page: int) -> tuple[int, list[int]]:
    """Approximate which subject(s) appear on this page.

    Each round contains 80 questions across ~26-29 content pages, ~3 q/page.
    Returns (primary_subject, [all_subjects_possibly_present]).
    Calibration points:
      - Round 1: Q1 starts at 25-2, Q41 at 25-15 (12 pages for Q1-40).
      - Round 2: Q1 starts at 25-28.
      - Round 3: Q1 starts at 25-56.
    """
    info = ROUND_INFO[round_no]
    round_first = info["first_page"]
    round_last = info["last_page"]
    span = round_last - round_first + 1   # pages in the round
    rel = book_page - round_first         # 0-based position within round
    # 80 questions per round, distributed proportionally
    q_per_page = 80 / span
    q_start = max(1, int(rel * q_per_page))         # approx first question on this page
    q_end = min(80, int((rel + 1) * q_per_page) + 1)  # approx last question

    def q_to_subj(q: int) -> int:
        if q <= 20: return 1
        if q <= 40: return 2
        if q <= 60: return 3
        return 4

    subjects = sorted({q_to_subj(q_start), q_to_subj(q_end)})
    return subjects[0], subjects


def harvest_mnemonic_keywords() -> list[dict]:
    """Pull 'keyword' words from '기억법 <KEYWORD>' lines in OCR.

    We keep just the keyword token (single word), not the tip text, to stay
    structural. Each item also records the round it belongs to.
    """
    if not OCR_PATH.exists():
        return []
    lines = OCR_PATH.read_text(encoding="utf-8").splitlines()

    # Find round boundaries
    round_starts = []
    for i, ln in enumerate(lines):
        m = re.search(r"2025년.*기사 제\s*(\d+)\s*회", ln)
        if m:
            round_starts.append((int(m.group(1)), i))
    round_starts.sort(key=lambda x: x[1])

    def round_for_line(idx: int) -> int:
        rnd = 0
        for r, start in round_starts:
            if idx >= start:
                rnd = r
            else:
                break
        return rnd

    out = []
    seen = set()
    for i, ln in enumerate(lines):
        m = re.search(r"기억법\s+([^\s（）()。.,;:]+)", ln)
        if not m:
            continue
        keyword = m.group(1).strip()
        # very short or noisy → skip
        if len(keyword) < 2 or len(keyword) > 30:
            continue
        rnd = round_for_line(i)
        key = (rnd, keyword)
        if key in seen:
            continue
        seen.add(key)
        out.append({"round": rnd, "keyword": keyword, "ocr_line": i})
    return out


def build_pages() -> list[dict]:
    pages = []
    for entry in CHUNK_LAYOUT:
        chunk = entry["chunk"]
        n = entry["pages_in_chunk"]
        rnd = entry["round"]
        cover_first = entry["cover_first"]
        first_book = entry["first_book"]
        for i in range(1, n + 1):
            file_name = f"p{chunk:02d}_{i:02d}.jpg"
            if cover_first and i == 1:
                pages.append({
                    "file": file_name,
                    "chunk": chunk,
                    "in_chunk": i,
                    "is_cover": True,
                    "round": None,
                    "book_page": None,
                    "page_marker": None,
                    "primary_subject": None,
                    "subjects": [],
                })
                continue
            # Compute book page
            offset = (i - 1) if not cover_first else (i - 2)  # cover takes slot 1
            book_page = first_book + offset
            primary, subjs = approximate_subject(rnd, book_page)
            pages.append({
                "file": file_name,
                "chunk": chunk,
                "in_chunk": i,
                "is_cover": False,
                "round": rnd,
                "book_page": book_page,
                "page_marker": f"25-{book_page}",
                "primary_subject": primary,
                "subjects": subjs,
            })
    return pages


def main() -> None:
    pages = build_pages()
    keywords = harvest_mnemonic_keywords()

    # Verify all image files exist
    missing = []
    for p in pages:
        if not (WEB_DIR / p["file"]).exists():
            missing.append(p["file"])
    if missing:
        print(f"WARNING: {len(missing)} expected images missing: {missing[:5]}...")

    out = {
        "year": 2025,
        "rounds": {
            str(k): {**v, "subject_starts": {}} for k, v in ROUND_INFO.items()
        },
        "subjects": SUBJECTS,
        "pages": pages,
        "mnemonic_keywords": keywords,
        "notes": (
            "Subject ranges per page are approximated by question-number density. "
            "The page image itself is the source of truth for question/answer/explanation. "
            "Filter by round is exact; filter by subject is heuristic."
        ),
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(ROOT)}: {len(pages)} pages, {len(keywords)} mnemonic keywords")
    by_round = {}
    for p in pages:
        if p["round"] is None: continue
        by_round.setdefault(p["round"], []).append(p)
    for r, items in sorted(by_round.items()):
        print(f"  Round {r}: {len(items)} content pages (book {items[0]['page_marker']} ~ {items[-1]['page_marker']})")


if __name__ == "__main__":
    main()

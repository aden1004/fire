"""Slice each scanned page into per-question card images.

We use Tesseract hOCR ONLY to locate question-number markers (e.g. "01", "02",
... in the left margin of each two-column page) and to find the y-coordinate
of '답' (answer) tokens. We never persist the OCR text — only y/x coordinates
flow downstream, and the output is a set of cropped JPEGs + structural metadata.

For each detected question on a page, we emit two crops:
    - question_only.jpg : top of region up to (just above the '답' line) -> shown first
    - full.jpg          : the entire question region including 답/해설  -> reveal

If '답' isn't found within the region, we fall back to splitting the region
65/35 (heuristic; the answer usually starts ~2/3 down).
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / "data" / "cache" / "pages"
OUT_DIR = ROOT / "public" / "cards" / "2025"
META_PATH = ROOT / "data" / "normalized" / "2025_cards.json"
PAGES_META = ROOT / "data" / "normalized" / "2025_pages.json"

HOCR_NS = {"x": "http://www.w3.org/1999/xhtml"}
BBOX_RE = re.compile(r"bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)")
QNUM_RE = re.compile(r"^0?[1-9][0-9]?$")  # "1".."80" or "01".."09"


def tesseract_hocr(image_path: Path) -> ET.Element:
    out = subprocess.run(
        ["tesseract", str(image_path), "stdout", "-l", "kor+eng", "hocr"],
        capture_output=True, text=True, check=True,
    )
    root = ET.fromstring(out.stdout)
    return root


def parse_bbox(title: str) -> tuple[int, int, int, int] | None:
    m = BBOX_RE.search(title or "")
    if not m: return None
    return tuple(int(g) for g in m.groups())  # type: ignore


def collect_word_boxes(root: ET.Element) -> list[dict]:
    """Return list of {text, bbox=(x1,y1,x2,y2)} for every word."""
    out = []
    for w in root.iter("{http://www.w3.org/1999/xhtml}span"):
        if w.attrib.get("class") != "ocrx_word":
            continue
        bbox = parse_bbox(w.attrib.get("title", ""))
        if not bbox:
            continue
        text = "".join(w.itertext()).strip()
        if text:
            out.append({"text": text, "bbox": bbox})
    return out


def find_question_anchors(words: list[dict], page_w: int) -> list[tuple[int, int, str]]:
    """Return [(column, y_top, qnum_str)] sorted by (column, y_top).

    Columns: 0=left, 1=right. Determined by x-center of the question-number bbox.
    """
    mid = page_w // 2
    hits: list[tuple[int, int, str]] = []
    for w in words:
        t = w["text"].strip().lstrip("0")
        if not t or not QNUM_RE.match(w["text"]):
            continue
        try:
            n = int(t or "0")
        except ValueError:
            continue
        if not (1 <= n <= 80):
            continue
        x1, y1, x2, y2 = w["bbox"]
        h = y2 - y1
        # Heuristic: question-number bullets are large characters (>=25px tall) sitting
        # within the leftmost 0..200px of each column.
        if h < 25:
            continue
        col = 0 if (x1 + x2) // 2 < mid else 1
        col_left = 0 if col == 0 else mid
        if x1 - col_left > 250:    # too far right within column → not a left-margin bullet
            continue
        hits.append((col, y1, w["text"]))
    # Dedup near-coincident detections
    hits.sort()
    dedup: list[tuple[int, int, str]] = []
    for col, y, num in hits:
        if dedup and dedup[-1][0] == col and abs(dedup[-1][1] - y) < 30:
            continue
        dedup.append((col, y, num))
    return dedup


def find_answer_y_positions(words: list[dict]) -> list[tuple[int, int]]:
    """Return [(x_mid, y_top)] for every '답' token (which precedes ① ② ③ ④)."""
    out = []
    for w in words:
        if w["text"].strip() == "답":
            x1, y1, x2, y2 = w["bbox"]
            out.append(((x1 + x2) // 2, y1))
    return out


def slice_page(page_image: Path, words: list[dict]) -> list[dict]:
    """Return per-question crop specs for this page."""
    img = Image.open(page_image)
    W, H = img.size
    mid_x = W // 2

    anchors = find_question_anchors(words, W)
    if not anchors:
        return []
    answers = find_answer_y_positions(words)

    # Build question regions: from this anchor's y down to next anchor in same column,
    # or down to bottom of page for last question in column.
    by_col: dict[int, list[tuple[int, str]]] = {0: [], 1: []}
    for col, y, num in anchors:
        by_col[col].append((y, num))

    cards: list[dict] = []
    PAD_TOP = 8
    PAD_BOTTOM = 12

    for col, items in by_col.items():
        items.sort()
        col_x1 = 0 if col == 0 else mid_x
        col_x2 = mid_x if col == 0 else W
        for i, (y_top, num) in enumerate(items):
            y_end = items[i + 1][0] if i + 1 < len(items) else H
            y_top_c = max(0, y_top - PAD_TOP)
            y_end_c = min(H, y_end - 2)
            # Find a '답' inside this region (same column)
            ans_y = None
            for ax, ay in answers:
                if y_top_c < ay < y_end_c and col_x1 <= ax < col_x2:
                    if ans_y is None or ay < ans_y:
                        ans_y = ay
            if ans_y is None:
                # heuristic fallback: 65% down
                ans_y = y_top_c + int((y_end_c - y_top_c) * 0.65)
            cards.append({
                "col": col, "qnum_label": num,
                "y_top": y_top_c, "y_answer": ans_y, "y_end": y_end_c,
                "x1": col_x1, "x2": col_x2,
                "width": col_x2 - col_x1,
                "height_q": ans_y - y_top_c,
                "height_full": y_end_c - y_top_c,
            })
    return cards


def emit_crops(page_image: Path, page_meta: dict, specs: list[dict], out_dir: Path) -> list[dict]:
    """Save question-only and full crops; return per-card metadata for the dataset."""
    img = Image.open(page_image)
    out_dir.mkdir(parents=True, exist_ok=True)
    cards_meta: list[dict] = []
    stem = page_image.stem  # e.g. "part02_p07"
    for idx, s in enumerate(specs):
        # Crop the whole question region (full)
        full = img.crop((s["x1"], s["y_top"], s["x2"], s["y_end"]))
        # Crop just the question portion (stem + choices, before 답)
        only = img.crop((s["x1"], s["y_top"], s["x2"], s["y_answer"]))
        # Resize widths for the web (max 900px wide)
        for crop, suffix in [(only, "q"), (full, "a")]:
            w, h = crop.size
            if w > 900:
                crop = crop.resize((900, int(h * 900 / w)), Image.LANCZOS)
            fname = f"{stem}_c{idx + 1:02d}_{suffix}.jpg"
            crop.convert("RGB").save(out_dir / fname, "JPEG", quality=82, optimize=True)
        # Best-guess question number from label, with leading zeros stripped
        try:
            qnum = int(s["qnum_label"].lstrip("0") or "0")
        except ValueError:
            qnum = 0
        cards_meta.append({
            "id": f"{stem}_c{idx + 1:02d}",
            "source_page": page_image.name,
            "round": page_meta.get("round"),
            "book_page": page_meta.get("book_page"),
            "page_marker": page_meta.get("page_marker"),
            "qnum_label": qnum,
            "subject": (
                1 if 1 <= qnum <= 20 else
                2 if 21 <= qnum <= 40 else
                3 if 41 <= qnum <= 60 else
                4 if 61 <= qnum <= 80 else None
            ),
            "col": s["col"],
            "img_question": f"{stem}_c{idx + 1:02d}_q.jpg",
            "img_full":     f"{stem}_c{idx + 1:02d}_a.jpg",
        })
    return cards_meta


def main() -> None:
    with PAGES_META.open(encoding="utf-8") as fp:
        pages = json.load(fp)["pages"]
    page_by_file = {p["file"].replace(".jpg", ".png"): p for p in pages}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_cards: list[dict] = []
    skipped: list[str] = []

    for png in sorted(PAGES_DIR.glob("part*_p*.png")):
        page_meta = page_by_file.get(png.name)
        if page_meta is None or page_meta.get("is_cover"):
            skipped.append(png.name)
            continue
        try:
            hocr = tesseract_hocr(png)
        except subprocess.CalledProcessError as e:
            print(f"tesseract failed on {png.name}: {e}")
            continue
        words = collect_word_boxes(hocr)
        specs = slice_page(png, words)
        if not specs:
            skipped.append(png.name)
            continue
        cards = emit_crops(png, page_meta, specs, OUT_DIR)
        all_cards.extend(cards)
        print(f"{png.name}: {len(cards)} cards")

    # Sort by round, qnum, page
    def sort_key(c: dict) -> tuple:
        return (c["round"] or 99, c["qnum_label"] or 99, c["book_page"] or 0, c["col"])
    all_cards.sort(key=sort_key)

    META_PATH.write_text(
        json.dumps({"year": 2025, "cards": all_cards, "skipped_pages": skipped},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nTotal cards: {len(all_cards)}; skipped pages: {len(skipped)}")


if __name__ == "__main__":
    main()

"""Build per-question cards by detecting ALL significant whitespace gaps
within each column.

Pipeline (all mechanical, image-only — no OCR text persisted):
  1. For each rendered full-page PNG in data/cache/pages/, crop the page into
     left + right column rectangles (header trimmed, gutter overlap kept tiny).
  2. Within each column, find every horizontal band where rows are dominantly
     white (the natural inter-question gap).
  3. Cluster adjacent bands so two narrow bands close to each other count as
     one boundary.
  4. Split the column at every boundary -> N+1 sub-cards.
  5. Drop sub-cards shorter than MIN_CARD_HEIGHT (clipped header/footer noise).
  6. Save final crops to public/cards/2025/ and rebuild 2025_cards.json.

Output naming: partXX_pNN_<side><k>.jpg  where <side> in {L,R} and <k> is the
1-based question index within that column (e.g. partXX_pNN_L1.jpg).
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / "data" / "cache" / "pages"
OUT_DIR = ROOT / "public" / "cards" / "2025"
META_PATH = ROOT / "data" / "normalized" / "2025_cards.json"
PAGES_META = ROOT / "data" / "normalized" / "2025_pages.json"

# Column extraction
TOP_TRIM_RATIO = 0.07
BOTTOM_TRIM_RATIO = 0.03
GUTTER_OVERLAP_RATIO = 0.01

# Whitespace band detection within each column
WHITE_PIXEL_THRESHOLD = 225      # 0-255 grayscale; pixel "white" if >= this
WHITE_ROW_FRAC = 0.95            # row counts as whitespace if >= 95% white
MIN_BAND_HEIGHT = 14             # band must be at least this many rows tall
CLUSTER_GAP_PX = 80              # bands closer than this collapse into one
MIN_CARD_HEIGHT = 250            # drop sub-cards shorter than this
ONLY_LARGEST_BAND = True         # only split at the single largest band per column

# Final web image
MAX_WIDTH = 900


def detect_split_points(gray: np.ndarray) -> list[int]:
    H, _ = gray.shape
    white_frac = (gray >= WHITE_PIXEL_THRESHOLD).mean(axis=1)
    is_ws = white_frac > WHITE_ROW_FRAC

    # Find raw bands of consecutive whitespace rows
    bands: list[tuple[int, int, int]] = []  # (start, end, length)
    i = 0
    while i < H:
        if is_ws[i]:
            j = i
            while j < H and is_ws[j]:
                j += 1
            if j - i >= MIN_BAND_HEIGHT:
                bands.append((i, j, j - i))
            i = j
        else:
            i += 1

    # Restrict to bands whose midpoint sits in interior of the column
    interior_lo = int(H * 0.25)
    interior_hi = int(H * 0.75)
    candidates = [(s, e, l) for (s, e, l) in bands
                  if interior_lo <= (s + e) // 2 <= interior_hi]
    if not candidates:
        return []

    if ONLY_LARGEST_BAND:
        s, e, _ = max(candidates, key=lambda b: b[2])
        return [(s + e) // 2]

    # Otherwise cluster nearby midpoints
    midpoints = sorted((s + e) // 2 for (s, e, _) in candidates)
    clustered: list[int] = []
    for m in midpoints:
        if clustered and m - clustered[-1] < CLUSTER_GAP_PX:
            clustered[-1] = (clustered[-1] + m) // 2
        else:
            clustered.append(m)
    return clustered


def slice_column(col_img: Image.Image) -> list[Image.Image]:
    gray = np.array(col_img.convert("L"))
    H = gray.shape[0]
    points = detect_split_points(gray)
    boundaries = [0, *points, H]
    pieces: list[Image.Image] = []
    for a, b in zip(boundaries, boundaries[1:]):
        if b - a < MIN_CARD_HEIGHT:
            # too short to be a question — merge into the previous piece if any
            if pieces:
                last = pieces[-1]
                merged_top = last.size[1] != 0  # paranoid guard
                if merged_top:
                    new_h = last.size[1] + (b - a)
                    extra = col_img.crop((0, a, col_img.width, b))
                    out = Image.new("RGB", (col_img.width, new_h), "white")
                    out.paste(last, (0, 0))
                    out.paste(extra.convert("RGB"), (0, last.size[1]))
                    pieces[-1] = out
                continue
            else:
                continue
        pieces.append(col_img.crop((0, a, col_img.width, b)))
    return pieces


def emit_card(img: Image.Image, out_name: str) -> None:
    w, h = img.size
    if w > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, int(h * MAX_WIDTH / w)), Image.LANCZOS)
    img.convert("RGB").save(OUT_DIR / out_name, "JPEG", quality=82, optimize=True)


def main() -> None:
    pages_meta = json.loads(PAGES_META.read_text(encoding="utf-8"))["pages"]
    page_by_chunk_in = {(p["chunk"], p["in_chunk"]): p for p in pages_meta}

    # Wipe and recreate cards directory
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cards: list[dict] = []
    idx = 0
    pages_per_count: dict[int, int] = {}

    for png in sorted(PAGES_DIR.glob("part*_p*.png")):
        # part01_p02.png -> chunk=1, in_chunk=2
        base = png.stem  # 'part01_p02'
        chunk = int(base.split("_p")[0].removeprefix("part"))
        in_chunk = int(base.split("_p")[1])
        meta = page_by_chunk_in.get((chunk, in_chunk))
        if meta is None or meta.get("is_cover"):
            continue

        page = Image.open(png)
        W, H = page.size
        top = int(H * TOP_TRIM_RATIO)
        bot = int(H * (1 - BOTTOM_TRIM_RATIO))
        overlap = int(W * GUTTER_OVERLAP_RATIO)
        mid = W // 2
        left_col = page.crop((0, top, mid + overlap, bot))
        right_col = page.crop((max(0, mid - overlap), top, W, bot))

        for col_img, side in [(left_col, "L"), (right_col, "R")]:
            sub_cards = slice_column(col_img)
            n = len(sub_cards)
            pages_per_count[n] = pages_per_count.get(n, 0) + 1
            for k, piece in enumerate(sub_cards, start=1):
                idx += 1
                fname = f"{base}_{side}{k}.jpg"
                emit_card(piece, fname)
                cards.append({
                    "id": f"card{idx:03d}",
                    "file": fname,
                    "side": side,
                    "kth": k,
                    "n_in_col": n,
                    "source_page": meta["file"],
                    "round": meta["round"],
                    "book_page": meta["book_page"],
                    "page_marker": meta["page_marker"],
                    "subjects": meta["subjects"],
                    "primary_subject": meta["primary_subject"],
                })
        page.close()

    META_PATH.write_text(json.dumps(
        {"year": 2025, "card_count": len(cards), "cards": cards},
        ensure_ascii=False, indent=2,
    ), encoding="utf-8")
    print(f"Total cards: {len(cards)}")
    print("Sub-cards per column distribution:")
    for k in sorted(pages_per_count):
        print(f"  {k} pieces: {pages_per_count[k]} columns")
    by_round: dict[int, int] = {}
    for c in cards:
        r = c["round"] or 0
        by_round[r] = by_round.get(r, 0) + 1
    for r, n in sorted(by_round.items()):
        print(f"  Round {r}: {n}")


if __name__ == "__main__":
    main()

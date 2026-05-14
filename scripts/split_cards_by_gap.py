"""Re-slice each column card at the dominant whitespace gap (between questions).

For each column card image:
  1. Compute, for each row, the fraction of near-white pixels.
  2. Find consecutive bands of "mostly-white" rows of length >= MIN_BAND.
  3. Keep bands whose midpoint sits in the middle [MID_LO .. MID_HI] of the
     card (so we don't split off a tiny header/footer fragment).
  4. Pick the longest such band; split at its midpoint -> top + bottom card.
  5. If no qualifying band, keep the card as-is.

Output:
  - public/cards/2025/<stem>_T.jpg / _B.jpg  (split) OR
  - public/cards/2025/<stem>.jpg            (kept unsplit; renamed from _L/_R)
  - data/normalized/2025_cards.json (rebuilt)
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CARDS_DIR = ROOT / "public" / "cards" / "2025"
META_PATH = ROOT / "data" / "normalized" / "2025_cards.json"
PAGES_META = ROOT / "data" / "normalized" / "2025_pages.json"

WHITE_PIXEL_THRESHOLD = 225        # >= this on 0..255 grayscale counts as white
WHITE_ROW_FRAC = 0.95              # row is "whitespace" if >= 95% white pixels
MIN_BAND_HEIGHT = 12               # minimum band length in rows
MID_LO_RATIO = 0.28                # search band midpoint within this range
MID_HI_RATIO = 0.72

# Pixel-row whitespace bands we consider too small to be a question separator.
# (Tweaked empirically; a header/title rule is usually < 12 rows of pure white.)


def find_split_y(arr: np.ndarray) -> int | None:
    H, _ = arr.shape
    white_frac = (arr >= WHITE_PIXEL_THRESHOLD).mean(axis=1)
    ws = white_frac > WHITE_ROW_FRAC
    bands: list[tuple[int, int, int]] = []  # (start, end_exclusive, length)
    i = 0
    while i < H:
        if ws[i]:
            j = i
            while j < H and ws[j]:
                j += 1
            if j - i >= MIN_BAND_HEIGHT:
                bands.append((i, j, j - i))
            i = j
        else:
            i += 1
    if not bands:
        return None
    mid_lo = int(H * MID_LO_RATIO)
    mid_hi = int(H * MID_HI_RATIO)
    candidates = [(s, e, length) for s, e, length in bands
                  if mid_lo <= (s + e) // 2 <= mid_hi]
    if not candidates:
        return None
    s, e, length = max(candidates, key=lambda b: b[2])
    return (s + e) // 2


def main() -> None:
    pages_meta = json.loads(PAGES_META.read_text(encoding="utf-8"))["pages"]
    page_by_chunk_in = {(p["chunk"], p["in_chunk"]): p for p in pages_meta}

    # We'll re-emit ALL cards from scratch in this script. Old _L/_R files stay
    # on disk but are no longer referenced.
    out_cards: list[dict] = []
    idx = 0

    # Iterate the existing _L/_R column cards in deterministic order
    sources = sorted([f for f in os.listdir(CARDS_DIR)
                      if f.endswith(".jpg") and ("_L." in f or "_R." in f)])

    for src_name in sources:
        # src_name like 'part01_p02_L.jpg'
        stem = src_name.removesuffix(".jpg")           # 'part01_p02_L'
        base = stem.rsplit("_", 1)[0]                  # 'part01_p02'
        side = stem.rsplit("_", 1)[1]                  # 'L' or 'R'
        chunk = int(base.split("_p")[0].removeprefix("part"))
        in_chunk = int(base.split("_p")[1])
        page = page_by_chunk_in.get((chunk, in_chunk))
        if page is None or page.get("is_cover"):
            continue

        img = Image.open(CARDS_DIR / src_name)
        gray = np.array(img.convert("L"))
        split_y = find_split_y(gray)
        W, H = img.size

        if split_y is None:
            # Keep as single card
            idx += 1
            out_cards.append({
                "id": f"card{idx:03d}",
                "file": src_name,
                "split": False,
                "side": side,
                "source_page": page["file"],
                "round": page["round"],
                "book_page": page["book_page"],
                "page_marker": page["page_marker"],
                "subjects": page["subjects"],
                "primary_subject": page["primary_subject"],
            })
            continue

        # Split into top + bottom
        top = img.crop((0, 0, W, split_y))
        bot = img.crop((0, split_y, W, H))
        for crop, half_tag in [(top, "T"), (bot, "B")]:
            fname = f"{base}_{side}{half_tag}.jpg"
            crop.convert("RGB").save(CARDS_DIR / fname, "JPEG", quality=82, optimize=True)
            idx += 1
            out_cards.append({
                "id": f"card{idx:03d}",
                "file": fname,
                "split": True,
                "side": side,
                "half": half_tag,
                "source_page": page["file"],
                "round": page["round"],
                "book_page": page["book_page"],
                "page_marker": page["page_marker"],
                "subjects": page["subjects"],
                "primary_subject": page["primary_subject"],
            })

    META_PATH.write_text(json.dumps(
        {"year": 2025, "card_count": len(out_cards), "cards": out_cards},
        ensure_ascii=False, indent=2,
    ), encoding="utf-8")
    print(f"Wrote {len(out_cards)} cards (was 166)")
    split = sum(1 for c in out_cards if c.get("split"))
    print(f"  split into halves: {split}")
    print(f"  kept whole:        {len(out_cards) - split}")


if __name__ == "__main__":
    main()

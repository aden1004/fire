"""Slice each scanned page into per-column cards (left half + right half).

This is a mechanical image transformation — no OCR text is read or persisted.
Each page produces two cards: <stem>_L.jpg (left column) and <stem>_R.jpg
(right column). The page header strip (top ~7%) is trimmed off the first
content-bearing card so it doesn't dominate the view.

Resulting cards.json contains only structural metadata: source page, round,
book page marker, column, and a sequential card index. The image itself is
the source of truth.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / "data" / "cache" / "pages"
OUT_DIR = ROOT / "public" / "cards" / "2025"
META_PATH = ROOT / "data" / "normalized" / "2025_cards.json"
PAGES_META = ROOT / "data" / "normalized" / "2025_pages.json"

# Trim a thin top header band (round/page header) — keep it tiny so we don't
# clip the first question's bullet.
TOP_CROP_RATIO = 0.07
BOTTOM_CROP_RATIO = 0.025
MAX_WIDTH = 900  # px for web display


def slice_page(image_path: Path, out_dir: Path) -> list[dict]:
    img = Image.open(image_path)
    W, H = img.size
    top = int(H * TOP_CROP_RATIO)
    bot = int(H * (1 - BOTTOM_CROP_RATIO))
    # Slight overlap at column boundary so the gutter is never cut mid-content
    overlap = int(W * 0.01)
    mid = W // 2
    left_crop = img.crop((0, top, mid + overlap, bot))
    right_crop = img.crop((max(0, mid - overlap), top, W, bot))
    cards = []
    for crop, side in [(left_crop, "L"), (right_crop, "R")]:
        w, h = crop.size
        if w > MAX_WIDTH:
            crop = crop.resize((MAX_WIDTH, int(h * MAX_WIDTH / w)), Image.LANCZOS)
        fname = f"{image_path.stem}_{side}.jpg"
        crop.convert("RGB").save(out_dir / fname, "JPEG", quality=82, optimize=True)
        cards.append({"file": fname, "side": side})
    return cards


def main() -> None:
    with PAGES_META.open(encoding="utf-8") as fp:
        pages = json.load(fp)["pages"]
    # PNGs in data/cache/pages/ are named like 'part01_p02.png'; the metadata
    # 'file' field is the web JPEG name like 'p01_02.jpg'. Map via chunk/in_chunk.
    page_by_png = {
        f"part{p['chunk']:02d}_p{p['in_chunk']:02d}.png": p
        for p in pages
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cards: list[dict] = []
    idx = 0
    for png in sorted(PAGES_DIR.glob("part*_p*.png")):
        meta = page_by_png.get(png.name)
        if meta is None or meta.get("is_cover"):
            continue
        sliced = slice_page(png, OUT_DIR)
        for s in sliced:
            idx += 1
            cards.append({
                "id": f"card{idx:03d}",
                "file": s["file"],
                "side": s["side"],
                "source_page": meta["file"],          # original page jpeg
                "round": meta["round"],
                "book_page": meta["book_page"],
                "page_marker": meta["page_marker"],
                "subjects": meta["subjects"],
                "primary_subject": meta["primary_subject"],
            })

    META_PATH.write_text(
        json.dumps(
            {"year": 2025, "card_count": len(cards), "cards": cards},
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Sliced {len(cards)} cards from {len(set(c['source_page'] for c in cards))} pages")
    by_round = {}
    for c in cards:
        by_round.setdefault(c["round"], 0)
        by_round[c["round"]] += 1
    for r, n in sorted(by_round.items()):
        print(f"  Round {r}: {n} cards")


if __name__ == "__main__":
    main()

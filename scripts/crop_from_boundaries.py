"""Build per-question card crops from manually-marked Y boundaries.

Input:  data/cache/qboundaries.json  shape:
  {
    "part01_p02": {"left": [540, 880], "right": [290, 1050]},
    ...
  }
  Each list is the Y-coordinate of the TOP of each question's bullet on that
  page (in original PNG coordinates). Length = number of questions in that
  column. The crop for question i is from y[i] to y[i+1] (or column bottom).

Output: public/cards/2025/<page>_<col><k>.jpg
        data/normalized/2025_cards.json
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / "data" / "cache" / "pages"
OUT_DIR = ROOT / "public" / "cards" / "2025"
META_PATH = ROOT / "data" / "normalized" / "2025_cards.json"
PAGES_META = ROOT / "data" / "normalized" / "2025_pages.json"
BOUNDS_PATH = ROOT / "data" / "cache" / "qboundaries.json"

GUTTER_OVERLAP_RATIO = 0.01
BOTTOM_PAD = 8  # pixels of breathing room at the bottom of each crop
TOP_PAD = 6
MAX_WIDTH = 900


def main() -> None:
    pages_meta = json.loads(PAGES_META.read_text(encoding="utf-8"))["pages"]
    page_by_chunk_in = {(p["chunk"], p["in_chunk"]): p for p in pages_meta}
    bounds: dict[str, dict] = json.loads(BOUNDS_PATH.read_text(encoding="utf-8"))

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cards: list[dict] = []
    idx = 0
    pages_done = 0
    pages_skipped = 0

    for png in sorted(PAGES_DIR.glob("part*_p*.png")):
        base = png.stem
        chunk = int(base.split("_p")[0].removeprefix("part"))
        in_chunk = int(base.split("_p")[1])
        meta = page_by_chunk_in.get((chunk, in_chunk))
        if meta is None or meta.get("is_cover"):
            continue

        spec = bounds.get(base)
        if not spec:
            pages_skipped += 1
            continue

        page = Image.open(png)
        W, H = page.size
        overlap = int(W * GUTTER_OVERLAP_RATIO)
        mid = W // 2
        col_x = {
            "left":  (0, mid + overlap),
            "right": (max(0, mid - overlap), W),
        }

        for col_name, ys in [("left", spec.get("left", [])), ("right", spec.get("right", []))]:
            if not ys:
                continue
            x1, x2 = col_x[col_name]
            ys_sorted = sorted(int(y) for y in ys)
            for k, y_top in enumerate(ys_sorted, start=1):
                y_bot = ys_sorted[k] if k < len(ys_sorted) else H - 12
                top = max(0, y_top - TOP_PAD)
                bot = min(H, y_bot - 4 + BOTTOM_PAD)
                crop = page.crop((x1, top, x2, bot))
                w, h = crop.size
                if w > MAX_WIDTH:
                    crop = crop.resize((MAX_WIDTH, int(h * MAX_WIDTH / w)), Image.LANCZOS)
                side = "L" if col_name == "left" else "R"
                fname = f"{base}_{side}{k}.jpg"
                crop.convert("RGB").save(OUT_DIR / fname, "JPEG", quality=82, optimize=True)
                idx += 1
                cards.append({
                    "id": f"card{idx:03d}",
                    "file": fname,
                    "side": side,
                    "kth": k,
                    "n_in_col": len(ys_sorted),
                    "source_page": meta["file"],
                    "round": meta["round"],
                    "book_page": meta["book_page"],
                    "page_marker": meta["page_marker"],
                    "subjects": meta["subjects"],
                    "primary_subject": meta["primary_subject"],
                })
        page.close()
        pages_done += 1

    META_PATH.write_text(json.dumps(
        {"year": 2025, "card_count": len(cards), "cards": cards},
        ensure_ascii=False, indent=2,
    ), encoding="utf-8")
    print(f"Pages with boundaries: {pages_done}")
    print(f"Pages still to mark:   {pages_skipped}")
    print(f"Total cards: {len(cards)}")


if __name__ == "__main__":
    main()

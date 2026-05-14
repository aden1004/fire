"""Render every page of the original PDF to PNG using pypdfium2.

Run this once on the user's PC where the 150MB PDF lives. Output PNGs are
written under data/cache/pages/<round>/p<NNN>.png. The original PDF is *not*
copied or modified. Skips pages that already exist.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("pypdfium2 is required: pip install pypdfium2")

ROOT = Path(__file__).resolve().parents[1]


def render(pdf_path: Path, out_dir: Path, dpi: int = 200, page_range: range | None = None) -> int:
    pdf = pdfium.PdfDocument(str(pdf_path))
    out_dir.mkdir(parents=True, exist_ok=True)
    scale = dpi / 72.0
    pages = page_range if page_range else range(len(pdf))
    written = 0
    for i in pages:
        target = out_dir / f"p{i + 1:04d}.png"
        if target.exists():
            continue
        page = pdf[i]
        bitmap = page.render(scale=scale)
        pil = bitmap.to_pil()
        pil.save(target, optimize=True)
        bitmap.close()
        page.close()
        written += 1
        if written % 10 == 0:
            print(f"  rendered {written} pages (last: {target.name})")
    pdf.close()
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Render PDF pages to PNGs")
    parser.add_argument("pdf", type=Path, help="Path to the source PDF")
    parser.add_argument("--out", type=Path,
                        default=ROOT / "data" / "cache" / "pages",
                        help="Output directory")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--from-page", type=int, default=1, help="1-based start")
    parser.add_argument("--to-page", type=int, default=0, help="1-based end inclusive; 0=all")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.exit(f"PDF not found: {args.pdf}")

    pr = None
    if args.from_page > 1 or args.to_page:
        end = args.to_page if args.to_page else 10_000
        pr = range(args.from_page - 1, end)

    count = render(args.pdf, args.out, dpi=args.dpi, page_range=pr)
    print(f"Done. Wrote {count} new page images to {args.out}")


if __name__ == "__main__":
    main()

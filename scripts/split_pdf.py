"""Split a large PDF into smaller chunks under a target size (default 25 MB).

Uses pypdfium2 to copy pages between PDFs without re-rasterizing — much faster
than re-rendering and preserves quality. Outputs are written next to the source
as <name>.part01.pdf, <name>.part02.pdf, ... and each one's size is reported.

Usage:
    python scripts\\split_pdf.py "C:\\path\\to\\원본.pdf"
    python scripts\\split_pdf.py "C:\\path\\to\\원본.pdf" --max-mb 20
    python scripts\\split_pdf.py "C:\\path\\to\\원본.pdf" --out C:\\splits\\
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("pypdfium2 is required: pip install pypdfium2")

MB = 1024 * 1024


def chunk_pdf(src: Path, out_dir: Path, max_mb: int) -> list[Path]:
    src_pdf = pdfium.PdfDocument(str(src))
    total_pages = len(src_pdf)
    target_bytes = max_mb * MB
    out_dir.mkdir(parents=True, exist_ok=True)

    # Estimate pages per chunk from average page size, then bin-pack by trial.
    src_size = src.stat().st_size
    avg_per_page = src_size / max(1, total_pages)
    est_pages_per_chunk = max(1, int(target_bytes / avg_per_page * 0.95))
    print(f"Source: {src.name}  {src_size / MB:.1f} MB  {total_pages} pages")
    print(f"Initial estimate: ~{est_pages_per_chunk} pages per {max_mb}MB chunk")

    chunks: list[Path] = []
    cursor = 0
    part = 0

    while cursor < total_pages:
        part += 1
        # Try a candidate range; if it overshoots, halve and retry; if it
        # undershoots significantly and we still have pages, grow.
        lo = 1
        hi = min(est_pages_per_chunk * 2, total_pages - cursor)
        best_pages = 0
        best_path: Path | None = None
        # Bisection-ish: try hi first, shrink until under target, then keep best.
        candidate = min(hi, max(lo, est_pages_per_chunk))
        for _ in range(8):
            dst = pdfium.PdfDocument.new()
            dst.import_pages(src_pdf, list(range(cursor, cursor + candidate)))
            tmp = out_dir / f"{src.stem}.part{part:02d}.pdf"
            dst.save(str(tmp))
            dst.close()
            size = tmp.stat().st_size
            if size <= target_bytes:
                best_pages = candidate
                best_path = tmp
                if candidate == hi or candidate == total_pages - cursor:
                    break
                lo = candidate
                candidate = min(hi, candidate + max(1, (hi - candidate) // 2))
            else:
                hi = candidate - 1
                if hi < lo:
                    if best_path is not None:
                        break
                    candidate = max(1, candidate // 2)
                else:
                    candidate = max(lo, (lo + hi) // 2)
            if candidate <= 0:
                candidate = 1

        if best_path is None or best_pages == 0:
            # Even one page exceeds the limit; emit single-page chunk anyway.
            dst = pdfium.PdfDocument.new()
            dst.import_pages(src_pdf, [cursor])
            best_path = out_dir / f"{src.stem}.part{part:02d}.pdf"
            dst.save(str(best_path))
            dst.close()
            best_pages = 1
            print(
                f"  WARNING: page {cursor + 1} alone is "
                f"{best_path.stat().st_size / MB:.1f} MB (over target)"
            )

        size_mb = best_path.stat().st_size / MB
        print(
            f"  part{part:02d}: pages {cursor + 1}-{cursor + best_pages} "
            f"({best_pages} pages, {size_mb:.1f} MB) -> {best_path.name}"
        )
        chunks.append(best_path)
        cursor += best_pages
        # Refine estimate for next chunk based on actual yield.
        avg_per_page = best_path.stat().st_size / best_pages
        est_pages_per_chunk = max(1, int(target_bytes / avg_per_page * 0.95))

    src_pdf.close()
    return chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Split a PDF into size-bounded chunks.")
    parser.add_argument("pdf", type=Path, help="Source PDF path")
    parser.add_argument("--max-mb", type=int, default=25, help="Target max size per chunk (default 25 MB)")
    parser.add_argument("--out", type=Path, default=None, help="Output directory (default: same as source)")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.exit(f"PDF not found: {args.pdf}")
    out_dir = args.out or args.pdf.parent
    chunks = chunk_pdf(args.pdf, out_dir, args.max_mb)
    print(f"\nDone. {len(chunks)} chunks written to {out_dir}")


if __name__ == "__main__":
    main()

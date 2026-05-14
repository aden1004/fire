"""Extract OCR hints (round boundaries, page anchors, mnemonics, importance stars,
subject headers) from the OCR text. These hints are passed to Claude Vision as
auxiliary context. The PDF page image remains the primary truth source.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OCR_PATH = ROOT / "data" / "raw" / "2025" / "2025_ocr.txt"
OUT_PATH = ROOT / "data" / "normalized" / "2025_hints.json"

ROUND_RE = re.compile(r"2025년.*기사\s*제\s*(\d+)\s*회")
SUBJECT_RE = re.compile(r"제\s*([1-4])\s*과목\s*([가-힣\s]*)")
PAGE_TAG_RE = re.compile(r"25[-—–]\s*(\d+)")
FOOTER_RE = re.compile(r"25\.\s*(\d+)\.\s*시행/기사")
MNEMONIC_RE = re.compile(r"기억법\s*(.+)")
STAR_CHARS = "★☆食命金슈黎全錫黨命衾"


def load_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def find_round_boundaries(lines: list[str]) -> list[tuple[int, int, int]]:
    """Return [(round_num, start_line, end_line_exclusive), ...]."""
    hits = [(i, int(m.group(1))) for i, l in enumerate(lines) if (m := ROUND_RE.search(l))]
    if not hits:
        return []
    out = []
    for idx, (line_idx, rnd) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        out.append((rnd, line_idx, end))
    return out


def page_anchors(lines: list[str], start: int, end: int) -> list[tuple[int, int]]:
    """Return [(line_idx, page_num_within_round), ...] from '25-N' tags."""
    anchors = []
    for i in range(start, end):
        m = PAGE_TAG_RE.search(lines[i])
        if m:
            try:
                anchors.append((i, int(m.group(1))))
            except ValueError:
                pass
    return anchors


def collect_mnemonics(lines: list[str], start: int, end: int) -> list[dict]:
    out = []
    for i in range(start, end):
        m = MNEMONIC_RE.search(lines[i])
        if not m:
            continue
        context = "\n".join(lines[max(start, i - 4): min(end, i + 2)])
        out.append({"line": i, "tip_raw": m.group(1).strip(), "context": context})
    return out


def collect_subject_headers(lines: list[str], start: int, end: int) -> list[dict]:
    out = []
    for i in range(start, end):
        m = SUBJECT_RE.search(lines[i])
        if m:
            out.append({"line": i, "subject_num": int(m.group(1)), "tail": lines[i].strip()})
    return out


def collect_star_density(lines: list[str], start: int, end: int) -> list[dict]:
    """Per-line count of star-like characters (importance hint)."""
    out = []
    for i in range(start, end):
        cnt = sum(1 for ch in lines[i] if ch in STAR_CHARS)
        if cnt:
            out.append({"line": i, "count": cnt, "raw": lines[i].strip()[:80]})
    return out


def main() -> None:
    lines = load_lines(OCR_PATH)
    rounds = find_round_boundaries(lines)
    print(f"Detected rounds: {[(r, s, e) for r, s, e in rounds]}")

    payload = {
        "source": str(OCR_PATH.relative_to(ROOT)),
        "total_lines": len(lines),
        "rounds": [],
    }
    for rnd, start, end in rounds:
        payload["rounds"].append({
            "round": rnd,
            "line_start": start,
            "line_end": end,
            "page_anchors": page_anchors(lines, start, end),
            "subject_headers": collect_subject_headers(lines, start, end),
            "mnemonics": collect_mnemonics(lines, start, end),
            "star_density": collect_star_density(lines, start, end),
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(ROOT)}")

    for r in payload["rounds"]:
        print(
            f"  Round {r['round']}: "
            f"{len(r['page_anchors'])} page anchors, "
            f"{len(r['subject_headers'])} subject hits, "
            f"{len(r['mnemonics'])} mnemonic hints, "
            f"{len(r['star_density'])} star-marked lines"
        )


if __name__ == "__main__":
    main()

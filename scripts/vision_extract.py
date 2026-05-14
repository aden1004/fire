"""Per-page Vision extraction with Claude Opus 4.7.

For each rendered PNG, send the image + relevant OCR hints to Claude and
receive a structured list of questions on that page. Results are cached by
SHA-256 of the image file so re-runs only call the API for new/changed pages.

Run on the user's PC (where ANTHROPIC_API_KEY is set). The original 150MB PDF
is not transferred anywhere — only the per-page PNGs are sent to the API.

Key design choices:
- Model: claude-opus-4-7 (best at Korean technical text + diagrams)
- Adaptive thinking, effort=high (multi-column layout deserves careful read)
- Streaming with .get_final_message() to avoid HTTP timeouts on large pages
- Tool-use as JSON schema enforcement (strict=true)
- Prompt caching on the static system prompt
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
import time
from pathlib import Path

try:
    import anthropic
except ImportError:
    sys.exit("anthropic is required: pip install anthropic")

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / "data" / "cache" / "pages"
RESULTS_DIR = ROOT / "data" / "cache" / "vision"
HINTS_PATH = ROOT / "data" / "normalized" / "2025_hints.json"

MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = """\
You extract Korean firefighting-engineer exam questions from a scanned page image.

CRITICAL RULES — these are non-negotiable:
1. Reproduce question stems, answer choices, and the marked correct-answer label
   EXACTLY as printed. Do not paraphrase, translate, reorder, or "fix" anything.
2. Preserve original numerals, Korean particles, units, symbols, and punctuation.
3. Choice labels MUST be one of: ①, ②, ③, ④. There must be exactly four choices
   per question.
4. The correct-answer label (often near a "답" marker) must be one of those four.
5. Importance markers (★ stars, possibly OCR-mangled as 食 / 命 / 슈 / 黎 / ☆) →
   count the actual stars in the image and emit importance 1, 2, or 3.
6. Capture mnemonics introduced with "기억법" verbatim if present.
7. The page may show one question's stem in the left column while another
   question's explanation continues in the right column. Group content by the
   question NUMBER printed beside the stem — do NOT group by spatial proximity.
8. Some pages have NO questions (covers, instructions, table-of-contents).
   Return an empty list for those.
9. If a question stem is incomplete on this page (continues on the next page),
   set "complete": false and still include what is on this page.
10. Return ONLY the extract_questions tool call. No prose.

The OCR hint text provided is unreliable due to column mixing. Use it only to
disambiguate (e.g., which round, page-number anchor, candidate mnemonics).
Always defer to what the page IMAGE actually shows.
"""

TOOL_SCHEMA = {
    "name": "extract_questions",
    "description": "Emit the structured list of questions visible on this page.",
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "page_round": {
                "type": "integer",
                "description": "Exam round (제N회) this page belongs to: 1, 2, or 3.",
            },
            "page_marker": {
                "type": "string",
                "description": "The page tag printed on the page (e.g., '25-7'). Empty if absent.",
            },
            "subject_in_progress": {
                "type": "integer",
                "description": "Subject number (1=소방원론, 2=소방전기일반, 3=소방관계법규, 4=소방전기시설의 구조 및 원리) of the LAST question on this page. 0 if none.",
            },
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "number": {"type": "integer", "description": "Question number printed on the page (1-80)."},
                        "subject": {"type": "integer", "description": "1-4 per subject_in_progress mapping."},
                        "importance": {"type": "integer", "description": "Star count: 1, 2, or 3. Default 1 if unmarked."},
                        "stem": {"type": "string", "description": "Question body EXACTLY as printed."},
                        "choices": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "label": {"type": "string", "enum": ["①", "②", "③", "④"]},
                                    "text": {"type": "string"},
                                },
                                "required": ["label", "text"],
                            },
                        },
                        "answer": {"type": "string", "enum": ["①", "②", "③", "④", ""],
                                   "description": "Correct-answer label if shown on this page; empty string if not visible."},
                        "explanation": {"type": "string", "description": "Original explanation/해설 text if visible on this page; empty string otherwise."},
                        "mnemonics": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "tip": {"type": "string"},
                                },
                                "required": ["keyword", "tip"],
                            },
                        },
                        "complete": {"type": "boolean", "description": "True if the question is fully contained on this page."},
                    },
                    "required": ["number", "subject", "importance", "stem",
                                 "choices", "answer", "explanation", "mnemonics", "complete"],
                },
            },
        },
        "required": ["page_round", "page_marker", "subject_in_progress", "questions"],
    },
}


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    h.update(p.read_bytes())
    return h.hexdigest()


def find_round_for_page(page_num: int, hints: dict) -> int:
    """Heuristic: choose round by counting page-anchor hits within each round
    that match this page number. Returns 0 if unknown."""
    best_round, best_score = 0, -1
    for r in hints.get("rounds", []):
        anchors = [pn for _, pn in r.get("page_anchors", [])]
        # how close any anchor is to this page index (within first 100 pages)
        if not anchors:
            continue
        score = sum(1 for pn in anchors if pn == page_num)
        if score > best_score:
            best_round, best_score = r["round"], score
    return best_round


def hints_for_page(page_num: int, hints: dict) -> str:
    """Compact OCR hint text near the given page number."""
    bits = []
    for r in hints.get("rounds", []):
        mnemonics = [m["tip_raw"] for m in r.get("mnemonics", [])][:50]
        if mnemonics:
            bits.append(f"Round {r['round']} mnemonics seen in OCR:\n- " + "\n- ".join(mnemonics))
    return "\n\n".join(bits)[:4000]


def encode_image(path: Path) -> dict:
    data = base64.standard_b64encode(path.read_bytes()).decode("ascii")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": data},
    }


def call_vision(client: anthropic.Anthropic, image: Path, hint_text: str) -> dict:
    user_blocks = [encode_image(image)]
    if hint_text:
        user_blocks.append({"type": "text", "text": f"OCR hints (unreliable):\n{hint_text}"})
    user_blocks.append({"type": "text", "text": "Extract every question visible on this page."})

    with client.messages.stream(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        system=[{
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }],
        tools=[TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "extract_questions"},
        messages=[{"role": "user", "content": user_blocks}],
    ) as stream:
        msg = stream.get_final_message()

    for block in msg.content:
        if block.type == "tool_use" and block.name == "extract_questions":
            return {
                "tool_input": block.input,
                "usage": msg.usage.model_dump() if hasattr(msg.usage, "model_dump") else dict(msg.usage),
                "stop_reason": msg.stop_reason,
            }
    raise RuntimeError(f"No extract_questions tool_use in response: {msg.stop_reason}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages-dir", type=Path, default=PAGES_DIR)
    parser.add_argument("--limit", type=int, default=0, help="Stop after N new pages (0=all).")
    parser.add_argument("--force", action="store_true", help="Re-run even if cached.")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY env var is required.")
    if not args.pages_dir.exists():
        sys.exit(f"No rendered pages at {args.pages_dir}. Run render_pages.py first.")

    hints = json.loads(HINTS_PATH.read_text(encoding="utf-8")) if HINTS_PATH.exists() else {}
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    client = anthropic.Anthropic()

    images = sorted(args.pages_dir.glob("p*.png"))
    print(f"Found {len(images)} page images.")
    processed = 0

    for img in images:
        page_num = int(img.stem[1:])
        digest = sha256_file(img)
        cache_file = RESULTS_DIR / f"{img.stem}.{digest[:12]}.json"
        if cache_file.exists() and not args.force:
            continue

        hint_text = hints_for_page(page_num, hints)
        for attempt in range(3):
            try:
                result = call_vision(client, img, hint_text)
                break
            except anthropic.APIError as e:
                if attempt == 2:
                    raise
                wait = 2 ** attempt
                print(f"  {img.name}: API error, retry in {wait}s ({e})")
                time.sleep(wait)
        else:
            continue

        payload = {
            "page_image": str(img.relative_to(ROOT)),
            "sha256": digest,
            "page_num": page_num,
            "round_hint": find_round_for_page(page_num, hints),
            "model": MODEL,
            **result,
        }
        cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        n_q = len(result["tool_input"].get("questions", []))
        print(f"  {img.name}: {n_q} questions extracted -> {cache_file.name}")
        processed += 1
        if args.limit and processed >= args.limit:
            print(f"Hit --limit={args.limit}, stopping.")
            break

    print(f"Done. Processed {processed} new pages. Cache: {RESULTS_DIR}")


if __name__ == "__main__":
    main()

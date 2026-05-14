"""Merge per-page Vision JSON cache into the final normalized dataset, validate,
and produce a build report.

Inputs:  data/cache/vision/p*.json   (one per page, from vision_extract.py)
Output:  data/normalized/2025.json   (consumed by the Next.js app)
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VISION_DIR = ROOT / "data" / "cache" / "vision"
HINTS_PATH = ROOT / "data" / "normalized" / "2025_hints.json"
OUT_PATH = ROOT / "data" / "normalized" / "2025.json"
REPORT_PATH = ROOT / "data" / "normalized" / "2025_report.json"

SUBJECT_NAMES = {
    1: "소방원론",
    2: "소방전기일반",
    3: "소방관계법규",
    4: "소방전기시설의 구조 및 원리",
}


def load_pages() -> list[dict]:
    pages = []
    for p in sorted(VISION_DIR.glob("p*.json")):
        pages.append(json.loads(p.read_text(encoding="utf-8")))
    return pages


def coalesce_questions(pages: list[dict]) -> dict[tuple[int, int], dict]:
    """Merge by (round, question_number). Subsequent pages can supply the
    answer/explanation/mnemonics for a question whose stem started earlier."""
    merged: dict[tuple[int, int], dict] = {}
    for page in pages:
        tool = page.get("tool_input", {})
        rnd = tool.get("page_round") or page.get("round_hint") or 0
        for q in tool.get("questions", []):
            key = (rnd, q["number"])
            cur = merged.get(key)
            if cur is None:
                merged[key] = {
                    "round": rnd,
                    "number": q["number"],
                    "subject": q["subject"],
                    "subject_name": SUBJECT_NAMES.get(q["subject"], "unknown"),
                    "importance": q["importance"],
                    "stem": q["stem"],
                    "choices": q["choices"],
                    "answer": q["answer"],
                    "explanation": q["explanation"],
                    "mnemonics": list(q.get("mnemonics", [])),
                    "pages": [page["page_num"]],
                    "complete": q.get("complete", True),
                }
                continue
            # Merge: prefer non-empty answer/explanation, accumulate mnemonics
            if not cur["answer"] and q["answer"]:
                cur["answer"] = q["answer"]
            if q["explanation"] and len(q["explanation"]) > len(cur["explanation"]):
                cur["explanation"] = q["explanation"]
            for m in q.get("mnemonics", []):
                if m not in cur["mnemonics"]:
                    cur["mnemonics"].append(m)
            if page["page_num"] not in cur["pages"]:
                cur["pages"].append(page["page_num"])
            cur["complete"] = cur["complete"] or q.get("complete", True)
    return merged


def validate(questions: list[dict]) -> dict:
    by_round = defaultdict(list)
    for q in questions:
        by_round[q["round"]].append(q)

    issues: list[str] = []
    per_round = {}
    for rnd, items in sorted(by_round.items()):
        subj_counts = Counter(q["subject"] for q in items)
        ans_dist = Counter(q["answer"] or "?" for q in items)
        missing_answer = [q["number"] for q in items if not q["answer"]]
        bad_choice_len = [q["number"] for q in items if len(q["choices"]) != 4]
        per_round[rnd] = {
            "count": len(items),
            "by_subject": dict(subj_counts),
            "answer_distribution": dict(ans_dist),
            "missing_answer": missing_answer,
            "bad_choice_count": bad_choice_len,
        }
        if len(items) != 80:
            issues.append(f"Round {rnd}: expected 80 questions, got {len(items)}")
        for s in (1, 2, 3, 4):
            if subj_counts.get(s, 0) != 20:
                issues.append(f"Round {rnd} Subject {s}: expected 20, got {subj_counts.get(s, 0)}")
        if missing_answer:
            issues.append(f"Round {rnd}: {len(missing_answer)} questions missing answer label")
        if bad_choice_len:
            issues.append(f"Round {rnd}: {len(bad_choice_len)} questions have ≠4 choices")
    return {"per_round": per_round, "issues": issues}


def main() -> None:
    if not VISION_DIR.exists():
        sys.exit("No vision cache yet. Run vision_extract.py first.")
    pages = load_pages()
    print(f"Loaded {len(pages)} page results")

    merged = coalesce_questions(pages)
    questions = sorted(merged.values(), key=lambda q: (q["round"], q["subject"], q["number"]))
    for q in questions:
        q["id"] = f"2025-r{q['round']}-s{q['subject']}-q{q['number']:02d}"

    # All mnemonics aggregated for the dedicated page
    all_mnemonics = []
    for q in questions:
        for m in q["mnemonics"]:
            all_mnemonics.append({
                "round": q["round"],
                "subject": q["subject"],
                "subject_name": q["subject_name"],
                "question_id": q["id"],
                "question_number": q["number"],
                "keyword": m["keyword"],
                "tip": m["tip"],
            })

    report = validate(questions)
    dataset = {
        "year": 2025,
        "subjects": SUBJECT_NAMES,
        "questions": questions,
        "mnemonics": all_mnemonics,
        "report": report,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUT_PATH.relative_to(ROOT)}: {len(questions)} questions, {len(all_mnemonics)} mnemonics")
    for rnd, r in report["per_round"].items():
        print(f"  Round {rnd}: {r['count']} questions; by subject {r['by_subject']}")
    if report["issues"]:
        print("\nVALIDATION ISSUES:")
        for issue in report["issues"]:
            print(f"  - {issue}")
        print(f"\nFull report at {REPORT_PATH.relative_to(ROOT)}")
    else:
        print("\nValidation: OK")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
HWPX 양식 스캐너 — 양식 파일에서 placeholder 후보를 자동 추출하여
template.meta.json 골격을 만들어 준다.

사용법:
    python scan_template.py <template.hwpx> [-o output.meta.json]

스캔 결과:
    - 양식 내 모든 텍스트 노드를 추출
    - 등장 횟수 ≥ 2 → 순차 치환 후보(sequential)
    - 등장 횟수 == 1 → 단일 치환 후보(single)
    - 날짜 패턴(YYYY. M. D.) → date 타입 후보

생성된 .meta.json 은 placeholder만 채워져 있고
key/name/description은 TODO로 표시되어 있어,
사용자가 수동으로 의미를 부여하면 된다.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path


DATE_PATTERN = re.compile(
    r"^\s*\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\.?\s*$"
)


def scan_template(hwpx_path: str | Path) -> dict:
    """양식 hwpx에서 텍스트 노드를 추출해 후보 메타파일을 생성."""
    try:
        from hwpx import ObjectFinder
    except ImportError:
        print("Error: python-hwpx 라이브러리가 필요합니다.")
        print("       pip install python-hwpx --break-system-packages")
        sys.exit(1)

    finder = ObjectFinder(str(hwpx_path))
    texts: list[str] = []
    for r in finder.find_all(tag="t"):
        if r.text and r.text.strip():
            texts.append(r.text)

    counter = Counter(texts)

    fields = []
    for idx, (text, count) in enumerate(counter.most_common(), start=1):
        # 너무 짧은 텍스트(1-2글자 기호 등)는 placeholder 후보에서 제외
        # 단, 날짜 같이 의미있는 짧은 패턴은 유지
        if len(text.strip()) <= 1 and not DATE_PATTERN.match(text):
            continue

        # 로마숫자 단일 글자(Ⅰ, Ⅱ 등)는 보통 양식 자체의 구조이므로 제외
        if text.strip() in {"Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"}:
            continue

        # 타입 추정
        if DATE_PATTERN.match(text):
            ftype = "date"
        elif count >= 2:
            ftype = "sequential"
        else:
            ftype = "single"

        field = {
            "key": f"TODO_field_{idx:02d}",
            "placeholder": text,
            "type": ftype,
            "required": False,
            "_hint": f"양식 내 {count}회 등장",
        }
        if ftype == "sequential":
            field["max_count"] = count
        if ftype == "date":
            field["format"] = "YYYY. M. D."
            field["default"] = "today"

        fields.append(field)

    meta = {
        "name": "TODO - 양식 이름 (예: '내부 보고서')",
        "description": "TODO - 양식 설명 (예: '기관 내부 보고용. 표지 + 목차 + 본문')",
        "fields": fields,
    }

    return meta


def _cli():
    parser = argparse.ArgumentParser(
        description="HWPX 양식에서 placeholder 후보를 추출하여 meta.json 골격을 생성합니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python scan_template.py my-template.hwpx
  python scan_template.py my-template.hwpx -o my-template.meta.json

생성된 .meta.json 의 'key', 'name', 'description', 'required' 등을
수동으로 채우면 render.py 로 바로 사용 가능합니다.
""",
    )
    parser.add_argument("hwpx_path", help=".hwpx 양식 파일 경로")
    parser.add_argument(
        "-o", "--output",
        help="출력 .meta.json 경로 (지정하지 않으면 stdout)",
    )
    args = parser.parse_args()

    hwpx_path = Path(args.hwpx_path)
    if not hwpx_path.is_file():
        print(f"Error: 파일이 없습니다: {hwpx_path}")
        sys.exit(1)

    meta = scan_template(hwpx_path)
    output_text = json.dumps(meta, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_text)
        print(f"메타파일 골격 생성: {args.output}")
        print(f"  - 발견된 placeholder 후보: {len(meta['fields'])}개")
        print("  - 'key', 'name', 'description', 'required' 등을 수동 편집하세요.")
    else:
        print(output_text)


if __name__ == "__main__":
    _cli()

#!/usr/bin/env python3
"""
HWPX 렌더 결과 검증 헬퍼

생성된 hwpx의 모든 텍스트 노드를 읽어, 남아있는 placeholder가 있는지
확인하고 결과를 출력한다.

사용법:
    python verify.py <result.hwpx> [<template.meta.json>]

template.meta.json 을 함께 전달하면 placeholder 잔존 여부까지 검사한다.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def extract_texts(hwpx_path: str) -> list[str]:
    """hwpx의 모든 텍스트 노드를 추출."""
    try:
        from hwpx import ObjectFinder
    except ImportError:
        print("Error: python-hwpx 라이브러리가 필요합니다.")
        sys.exit(1)

    finder = ObjectFinder(hwpx_path)
    return [
        r.text for r in finder.find_all(tag="t")
        if r.text and r.text.strip()
    ]


def verify(hwpx_path: str, meta_path: str | None = None) -> int:
    """검증을 수행하고 잔존 placeholder 개수를 반환."""
    print(f"==> 검증: {hwpx_path}")
    texts = extract_texts(hwpx_path)
    print(f"  텍스트 노드: {len(texts)}개")

    if not meta_path:
        print("\n--- 전체 텍스트 ---")
        for t in texts:
            print(f"  {t!r}")
        return 0

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    placeholders = [f["placeholder"] for f in meta.get("fields", [])]
    remaining = []
    for ph in placeholders:
        hit_count = sum(1 for t in texts if ph in t)
        if hit_count > 0:
            remaining.append((ph, hit_count))

    if remaining:
        print("\n  ⚠️  잔존 placeholder 발견:")
        for ph, count in remaining:
            print(f"     [{count}회] {ph!r}")
        return len(remaining)
    else:
        print("\n  ✅ 잔존 placeholder 없음. 치환 완료.")
        return 0


def _cli():
    parser = argparse.ArgumentParser(description="HWPX 렌더 결과 검증")
    parser.add_argument("hwpx_path", help="검증할 .hwpx 파일")
    parser.add_argument(
        "meta_path",
        nargs="?",
        default=None,
        help="(선택) template.meta.json 경로 - 잔존 placeholder 검사용",
    )
    args = parser.parse_args()

    if not Path(args.hwpx_path).is_file():
        print(f"Error: 파일이 없습니다: {args.hwpx_path}")
        sys.exit(1)

    remaining = verify(args.hwpx_path, args.meta_path)
    sys.exit(1 if remaining > 0 else 0)


if __name__ == "__main__":
    _cli()

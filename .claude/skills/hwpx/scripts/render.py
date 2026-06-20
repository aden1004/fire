#!/usr/bin/env python3
"""
HWPX 양식 기반 렌더링 엔진 (양식 무관)

assets/<양식>/template.hwpx 와 template.meta.json 한 쌍이 있으면
어떤 양식이든 동일한 코드로 처리한다.

사용법:
    from render import render

    render(
        template_dir="assets/report",
        output_path="/mnt/user-data/outputs/result.hwpx",
        data={
            "기관명": "○○고등학교",
            "보고서_제목": "AI 활용 교사 연수 결과",
            "작성일": "today",
            "본문_1단계": ["추진 배경", "추진 경과", "성과", "향후 계획"],
        },
    )
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any

# fix_namespaces 를 같은 디렉토리에서 import
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)
from fix_namespaces import fix_hwpx_namespaces  # noqa: E402


# ---------------------------------------------------------------------------
# 내부 유틸 (ZIP 치환)
# ---------------------------------------------------------------------------

def _zip_replace_all(hwpx_path: str, replacements: dict[str, str]) -> None:
    """HWPX ZIP 내 모든 Contents/*.xml 에서 텍스트를 일괄 치환."""
    if not replacements:
        return

    tmp = hwpx_path + ".tmp"
    with zipfile.ZipFile(hwpx_path, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename.startswith("Contents/") and item.filename.endswith(".xml"):
                    text = data.decode("utf-8")
                    for old, new in replacements.items():
                        text = text.replace(_xml_escape(old), _xml_escape(new))
                    data = text.encode("utf-8")
                zout.writestr(item, data)
    os.replace(tmp, hwpx_path)


def _zip_replace_sequential(hwpx_path: str, placeholder: str, values: list[str]) -> None:
    """section XML에서 placeholder를 순서대로 values 각각의 값으로 1회씩 치환."""
    if not values:
        return

    tmp = hwpx_path + ".tmp"
    with zipfile.ZipFile(hwpx_path, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                # 본문은 section* 파일에 들어있음
                if "section" in item.filename and item.filename.endswith(".xml"):
                    text = data.decode("utf-8")
                    placeholder_esc = _xml_escape(placeholder)
                    for new_val in values:
                        text = text.replace(placeholder_esc, _xml_escape(new_val), 1)
                    data = text.encode("utf-8")
                zout.writestr(item, data)
    os.replace(tmp, hwpx_path)


def _zip_replace_image(hwpx_path: str, image_path_in_zip: str, new_image_bytes: bytes) -> None:
    """HWPX ZIP 내부의 특정 이미지 파일을 새 이미지로 교체.

    Args:
        hwpx_path: HWPX 파일 경로
        image_path_in_zip: ZIP 내부 이미지 경로 (예: 'BinData/image1.png')
        new_image_bytes: 새 이미지의 바이트 데이터 (PNG 권장)
    """
    tmp = hwpx_path + ".tmp"
    with zipfile.ZipFile(hwpx_path, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == image_path_in_zip:
                    zout.writestr(item, new_image_bytes)
                else:
                    zout.writestr(item, zin.read(item.filename))
    os.replace(tmp, hwpx_path)


def _render_text_image(text: str, width: int = 2000, height: int = 825,
                        bg_color: tuple = (255, 255, 255, 0),
                        text_color: tuple = (40, 40, 40, 255)) -> bytes:
    """텍스트를 PNG 이미지로 렌더링하여 바이트로 반환.

    HWPX 양식의 로고 자리에 학교명/기관명을 텍스트로 넣을 때 사용.

    Args:
        text: 이미지에 들어갈 텍스트 (학교명 등)
        width, height: 이미지 크기 (기본 2000x825 — Brother 로고 영역 비율)
        bg_color: 배경색 (기본 투명)
        text_color: 텍스트 색상 (기본 진회색)

    Returns:
        PNG 바이트 데이터
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise ImportError(
            "image_text 필드를 사용하려면 Pillow가 필요합니다.\n"
            "  pip install Pillow"
        )

    img = Image.new("RGBA", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # 한글 지원 폰트 자동 탐색 (시스템별 후보 경로)
    font_candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",       # macOS
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
        "C:/Windows/Fonts/malgunbd.ttf",                     # Windows
        "C:/Windows/Fonts/malgun.ttf",
    ]
    font = None
    # 텍스트 길이에 따라 동적으로 크기 결정
    base_size = max(80, min(280, int(width / max(len(text), 4) * 1.5)))
    for fp in font_candidates:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, base_size)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    # 텍스트 가운데 정렬
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    # textbbox는 baseline 기준이라 y 오프셋 보정 필요
    x = (width - tw) // 2 - bbox[0]
    y = (height - th) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=text_color)

    # PNG 바이트로 인코딩
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _xml_escape(s: str) -> str:
    """XML 텍스트 노드용 최소 이스케이프."""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


# ---------------------------------------------------------------------------
# 날짜 포맷
# ---------------------------------------------------------------------------

# 공문서/보고서 표준: 월·일 앞 0 없음. "2026. 5. 30."
DEFAULT_DATE_FORMAT_TOKEN = "YYYY. M. D."


def _format_date(value: Any, fmt: str | None = None) -> str:
    """
    value를 한국 공문서/보고서 표준 날짜 문자열로 변환.

    허용 입력:
        - "today" → 오늘
        - datetime / date 객체
        - "YYYY-MM-DD" / "YYYY.MM.DD" / "YYYY. M. D." 등 일반 문자열
        - 이미 포맷된 문자열은 그대로 통과
    """
    fmt = fmt or DEFAULT_DATE_FORMAT_TOKEN

    if isinstance(value, (datetime, date)):
        d = value if isinstance(value, date) and not isinstance(value, datetime) else value.date() if isinstance(value, datetime) else value
    elif isinstance(value, str):
        s = value.strip()
        if s.lower() == "today":
            d = date.today()
        else:
            d = _parse_date_string(s)
            if d is None:
                # 파싱 실패 → 사용자 의도 존중하여 원문 그대로 사용
                return s
    else:
        return str(value)

    return _apply_date_token(d, fmt)


def _parse_date_string(s: str) -> date | None:
    """관용적인 한국식 날짜 문자열들을 파싱."""
    import re

    # "2026. 5. 30." / "2026.5.30" / "2026-05-30" / "2026/5/30" 모두 시도
    m = re.match(r"^\s*(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?\s*$", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None


def _apply_date_token(d: date, fmt: str) -> str:
    """간단한 토큰 기반 날짜 포맷."""
    # 토큰: YYYY, YY, MM, M, DD, D
    out = fmt
    out = out.replace("YYYY", f"{d.year:04d}")
    out = out.replace("YY", f"{d.year % 100:02d}")
    out = out.replace("MM", f"{d.month:02d}")
    out = out.replace("DD", f"{d.day:02d}")
    # 단문자는 길게 매칭된 뒤에 처리
    out = out.replace("M", str(d.month))
    out = out.replace("D", str(d.day))
    return out


# ---------------------------------------------------------------------------
# 메인 진입점
# ---------------------------------------------------------------------------

def render(
    template_dir: str | os.PathLike,
    output_path: str | os.PathLike,
    data: dict[str, Any],
    *,
    strict: bool = True,
) -> str:
    """
    template_dir 안의 template.hwpx 와 template.meta.json 을 읽어
    data 로 채워 output_path 에 결과 hwpx를 만든다.

    Args:
        template_dir: 양식 폴더 (template.hwpx + template.meta.json 포함)
        output_path: 결과물 경로 (.hwpx)
        data: { 필드키: 값 } 또는 { 필드키: [값1, 값2, ...] } 구조
        strict: True면 required 필드 누락 시 ValueError 발생.
                False면 누락 필드는 경고만 출력하고 통과.

    Returns:
        output_path
    """
    template_dir = Path(template_dir)
    output_path = str(output_path)

    template_hwpx = template_dir / "template.hwpx"
    meta_json = template_dir / "template.meta.json"

    if not template_hwpx.is_file():
        raise FileNotFoundError(f"양식 파일이 없음: {template_hwpx}")
    if not meta_json.is_file():
        raise FileNotFoundError(f"메타 파일이 없음: {meta_json}")

    with open(meta_json, "r", encoding="utf-8") as f:
        meta = json.load(f)

    # 출력 디렉토리 보장
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # 1) 양식 복사
    shutil.copy2(template_hwpx, output_path)

    # 2) 필드 분류
    single_map: dict[str, str] = {}
    sequential_jobs: list[tuple[str, list[str]]] = []
    image_jobs: list[tuple[str, str]] = []  # (zip 내 이미지 경로, 텍스트)
    missing_required: list[str] = []

    for field in meta.get("fields", []):
        key = field["key"]
        placeholder = field["placeholder"]
        ftype = field.get("type", "single")
        value = data.get(key)

        if value is None or value == "":
            if field.get("required"):
                missing_required.append(key)
            continue

        if ftype == "single":
            single_map[placeholder] = str(value)

        elif ftype == "date":
            single_map[placeholder] = _format_date(value, field.get("format"))

        elif ftype == "sequential":
            if not isinstance(value, list):
                value = [value]
            values = [str(v) for v in value]
            # 최대 개수 제한 (양식의 placeholder 개수보다 많으면 잘림)
            max_count = field.get("max_count")
            if max_count is not None and len(values) > max_count:
                values = values[:max_count]
            sequential_jobs.append((placeholder, values))

        elif ftype == "image_text":
            # placeholder 가 ZIP 내부 이미지 경로 역할 (예: 'BinData/image1.png')
            image_jobs.append((placeholder, str(value)))

        else:
            raise ValueError(f"알 수 없는 필드 타입: {ftype} (필드: {key})")

    if missing_required and strict:
        raise ValueError(
            f"필수 필드 누락: {missing_required}\n"
            f"data 인자에 위 키들의 값을 채워주세요."
        )

    # 3) 일괄 치환 (단일 / 날짜)
    _zip_replace_all(output_path, single_map)

    # 4) 순차 치환 (반복 항목)
    for placeholder, values in sequential_jobs:
        _zip_replace_sequential(output_path, placeholder, values)

    # 5) 이미지 텍스트 치환 (학교명 → 이미지)
    for image_path_in_zip, text_value in image_jobs:
        png_bytes = _render_text_image(text_value)
        _zip_replace_image(output_path, image_path_in_zip, png_bytes)

    # 6) 네임스페이스 후처리 (필수)
    fix_hwpx_namespaces(output_path)

    return output_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cli():
    """
    CLI 사용법:
        python render.py <template_dir> <output.hwpx> <data.json>
    """
    if len(sys.argv) != 4:
        print("Usage: python render.py <template_dir> <output.hwpx> <data.json>")
        sys.exit(1)

    template_dir, output_path, data_json = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(data_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = render(template_dir, output_path, data)
    print(f"렌더링 완료: {result}")


if __name__ == "__main__":
    _cli()

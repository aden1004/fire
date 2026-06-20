#!/usr/bin/env python3
"""운영 계획서 양식 사용 예시"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SKILL_ROOT, "scripts"))

from render import render


def main():
    template_dir = os.path.join(SKILL_ROOT, "assets", "plan")
    output_path = "/tmp/example_plan.hwpx"

    data = {
        "계획서_제목": "2026학년도 AI 활용 행정 업무 자동화 운영 계획",
        "작성_기관": "경신고등학교 정보부",
        "작성일": "today",
        "추진_배경": [
            "AI 디지털 교과서 전면 도입에 따른 교사 디지털 역량 강화 필요",
            "행정 업무 자동화를 통한 교사의 수업 준비 시간 확보 필요",
            "교육부 AI 활용 교육 정책 추진",
        ],
        "추진_목표": [
            "교사 30명 이상 AI 활용 직무연수 이수",
            "교사별 자체 자동화 도구 1개 이상 제작",
            "행정 업무 처리 시간 30% 단축",
        ],
        "세부_추진_과제": [
            "Google AI Studio 활용 워크숍 운영 (5월)",
            "Antigravity 기반 자동화 실습 (6월)",
            "교사 자체 도구 제작 멘토링 (7~8월)",
            "성과 공유회 및 우수 사례 시상 (12월)",
        ],
        "일정_시기": ["2026. 3월", "2026. 5월", "2026. 7~8월", "2026. 12월"],
        "일정_내용": ["수요 조사·계획 수립", "직무연수 운영", "자체 도구 제작", "성과 공유회"],
        "일정_담당": ["정보부", "정보부·외부 강사", "정보부", "교무부·정보부"],
        "예산": "총 2,500,000원 (강사료 1,500,000원, 다과 300,000원, 자료 인쇄 700,000원)",
        "기대_효과": [
            "교사 디지털 역량 강화",
            "행정 업무 효율화 및 수업 준비 시간 확보",
            "학생 AI 활용 교육 기반 마련",
            "타 학교 사례 확산",
        ],
    }

    result = render(template_dir, output_path, data)
    print(f"✅ 생성 완료: {result}")


if __name__ == "__main__":
    main()

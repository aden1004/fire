#!/usr/bin/env python3
"""공문서(기안문) 양식 사용 예시"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SKILL_ROOT, "scripts"))

from render import render


def main():
    template_dir = os.path.join(SKILL_ROOT, "assets", "official-doc")
    output_path = "/tmp/example_official_doc.hwpx"

    data = {
        "수신처": "경신고등학교장",
        "제목": "2026학년도 AI 활용 교사 직무연수 안내",
        "관련_근거": "교육정책과-1234(2026. 2. 1.)호",
        "본문_도입": "2026학년도 교사 디지털 역량 강화를 위한 AI 활용 직무연수를 아래와 같이 안내하오니 관심 있는 교원의 적극적인 참여 바랍니다.",
        "본문_2단계": [
            "일시: 2026. 5. 30.(토) 14:00~17:00",
            "장소: 대구창의융합교육원 컴퓨터실",
            "대상: 중등 교사 30명",
            "내용: AI 활용 행정 업무 자동화 실습",
        ],
        "본문_3단계": [
            "사전 신청: 5월 25일까지 NEIS 직무연수 신청",
            "필수 준비물: 노트북, 충전기",
        ],
        "붙임": "2026학년도 AI 활용 교사 직무연수 계획서 1부.",
    }

    result = render(template_dir, output_path, data)
    print(f"✅ 생성 완료: {result}")


if __name__ == "__main__":
    main()

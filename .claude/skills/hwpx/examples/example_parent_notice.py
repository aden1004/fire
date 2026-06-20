#!/usr/bin/env python3
"""학부모 안내문(가정통신문) 양식 사용 예시"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SKILL_ROOT, "scripts"))

from render import render


def main():
    template_dir = os.path.join(SKILL_ROOT, "assets", "parent-notice")
    output_path = "/tmp/example_parent_notice.hwpx"

    data = {
        "학교명": "경신고등학교",
        "안내문_번호": "가정통신문 제2026-15호",
        "제목": "2026학년도 1학기 학부모 진로진학 설명회 안내",
        "인사말": "안녕하십니까. 학교 교육 활동에 늘 협조해 주시는 학부모님께 깊은 감사를 드립니다.",
        "안내_도입": "아래와 같이 2026학년도 1학기 학부모 진로진학 설명회를 개최하오니 자녀의 진로 설계를 위해 많은 참여를 부탁드립니다.",
        "안내_항목": [
            "일시: 2026. 6. 15.(토) 14:00~16:00",
            "장소: 본교 대강당 (3층)",
            "대상: 2학년 학부모님",
            "내용: 2027학년도 대입 전형 변화, 학종 준비 전략, Q&A",
            "신청방법: 별지 신청서를 6월 10일까지 담임선생님께 제출",
        ],
        "마무리_인사": "가정의 평안과 자녀의 건강한 성장을 진심으로 기원합니다.",
        "발송일": "today",
        "학교장_명의": "경신고등학교장",
    }

    result = render(template_dir, output_path, data)
    print(f"✅ 생성 완료: {result}")


if __name__ == "__main__":
    main()

# 소방설비기사(전기) 기출 문제은행

단기 시험 대비용 개인 학습 웹앱. 원본 PDF는 사용자 PC에 두고 Claude Vision으로
정확하게 추출한 정규화 JSON만 깃에 커밋한다.

## 빠른 시작

```bash
# 1) 의존성 설치 후 샘플 데이터로 UI 확인
npm install
npm run dev          # http://localhost:3000

# 2) 실제 데이터 빌드 (Windows에서 직접)
#    상세 절차: scripts/README.md
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r scripts\requirements.txt
$env:ANTHROPIC_API_KEY = "sk-ant-..."
python scripts\extract_hints.py
python scripts\render_pages.py "C:\path\to\원본.pdf"
python scripts\vision_extract.py
python scripts\build_dataset.py

# 3) 생성된 data/normalized/2025.json 커밋 후 다시 npm run dev
```

`data/normalized/2025.json`이 없으면 자동으로 `2025.sample.json` 더미가 사용된다.

## 구성
- `PRD.md` — 요구사항·설계·결정사항·정확성 가드
- `scripts/` — 데이터 파이프라인 (OCR 힌트, PDF 렌더, Vision 추출, 빌드·검증)
- `app/` — Next.js App Router 페이지
  - `/` 홈, `/questions` 목록·필터, `/questions/[id]` 단일 문제
  - `/mnemonics` 암기팁 모음
  - `/mock` 모의고사 (80문 × 2시간)
  - `/notes` 오답노트·북마크 (IndexedDB)
- `lib/` — 데이터 로더, 로컬 저장소

## 핵심 원칙
- 문제 본문·보기·정답 라벨은 **절대 변형 금지**.
- OCR은 보조 힌트, **PDF 페이지 이미지가 정본**.
- 원본 PDF·OCR txt·Vision 캐시는 `.gitignore`로 깃 제외.

자세한 사용법은 `scripts/README.md`와 `PRD.md` 참조.

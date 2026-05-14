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

## 원클릭 실행 (Windows)

```powershell
# 한 번에 끝내기 (가상환경·의존성·OCR힌트·렌더·Vision·빌드)
.\scripts\run_pipeline.ps1 -PdfPath "C:\path\to\원본.pdf"

# 우선 5페이지만 Vision 호출해 결과 검수
.\scripts\run_pipeline.ps1 -PdfPath "C:\path\to\원본.pdf" -Limit 5

# 25MB 단위로 PDF만 쪼개기 (업로드용)
.\scripts\run_pipeline.ps1 -PdfPath "C:\path\to\원본.pdf" -Split
```

ANTHROPIC_API_KEY가 환경변수에 없으면 안전하게 입력받습니다.

## Vercel 배포 (선택)

데이터 빌드를 끝낸 뒤(`data/normalized/2025.json` 커밋 완료) 어디서나 웹/모바일에서
접속하고 싶다면 Vercel 무료 티어로 배포:

1. https://vercel.com 가입 후 GitHub 연동
2. Dashboard → **Add New… → Project** → 이 저장소(`fire`) 임포트
3. Framework Preset: **Next.js** 자동 인식, Root Directory: `.` 그대로
4. Branch: `claude/exam-prep-dual-pdf-nDA8i` (또는 main에 머지 후 main)
5. **Deploy** 클릭 — 약 1분 뒤 `https://<프로젝트명>.vercel.app`에서 사용 가능

데이터셋이 깃에 포함되어 있어 환경변수·DB 설정 불필요. 푸시할 때마다 자동 재배포.
모바일에서 PWA 설치: 사파리/크롬 메뉴 → "홈 화면에 추가".

> 데이터는 본인이 매입한 책의 사본을 처리한 것이므로 **저장소는 Private**으로 유지하는 걸 권장합니다.

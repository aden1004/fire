# 데이터 파이프라인 실행 안내

원본 PDF(약 150MB)는 사용자 PC에만 두고, 이 디렉터리의 스크립트로 로컬에서
정규화된 작은 JSON을 만들어 깃에 푸시한다.

## 0. 사전 준비 (Windows PowerShell)

```powershell
cd C:\path\to\fire
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r scripts\requirements.txt

# Claude API 키 (현재 세션에만 적용)
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

## 1. OCR 힌트 추출

원본 PDF는 필요 없고, 이미 받은 `data/raw/2025/2025_ocr.txt`만 사용한다.
회차/페이지 앵커/기억법/별표 위치를 뽑아 `data/normalized/2025_hints.json`에 저장.

```powershell
python scripts\extract_hints.py
```

## 2. 페이지 PNG 렌더

```powershell
# 전체
python scripts\render_pages.py "C:\00_지석업무\2026\소방설비기사필기주닙\2025소방설비기사필기(전기)\2025소방설비기사필기(전기)\원본.pdf"

# 일부만 (예: 1~10페이지로 동작 확인)
python scripts\render_pages.py "...\원본.pdf" --from-page 1 --to-page 10
```

산출물: `data/cache/pages/pNNNN.png` (이 폴더는 `.gitignore`로 깃 제외).

## 3. Vision 추출

```powershell
# 우선 5페이지만 호출해 결과 검수
python scripts\vision_extract.py --limit 5

# 검수 OK면 전체
python scripts\vision_extract.py
```

산출물: `data/cache/vision/pNNNN.<sha12>.json` (페이지 이미지 해시 캐시).
이미 처리된 페이지는 자동 스킵. 강제 재실행은 `--force`.

비용 관리:
- 시스템 프롬프트는 `cache_control`로 캐시되어 페이지가 늘어날수록 입력 비용이 ~0.1×로 떨어진다.
- 페이지당 한 번만 호출. 같은 PNG는 다시 호출하지 않는다.
- 호출 전 `--limit 1`로 한 페이지 결과를 열어 스키마/내용이 기대대로인지 확인할 것.

## 4. 데이터셋 빌드 + 검증

```powershell
python scripts\build_dataset.py
```

산출물:
- `data/normalized/2025.json` — Next.js 앱이 정적 임포트하는 최종 데이터셋
- `data/normalized/2025_report.json` — 회차/과목별 문항 수, 정답 분포, 누락 리스트

검증 항목:
- 회차당 80문항 / 과목당 20문항
- 정답 라벨이 ①②③④ 중 하나
- 보기 4개
- 누락된 항목은 리포트에 출력되며 해당 페이지를 `--force`로 재처리해 보완

## 5. 깃 푸시

`data/raw/`, `data/cache/`는 `.gitignore`에 의해 제외된다.
정규화된 JSON과 리포트는 작아서 그대로 커밋 가능:

```powershell
git add data/normalized scripts
git commit -m "Add 2025 extracted dataset"
git push -u origin claude/exam-prep-dual-pdf-nDA8i
```

## 문제 발생 시

- **`pypdfium2` 설치 실패**: Python 3.10+ 필요. `pip install --upgrade pip` 후 재시도.
- **Vision이 빈 questions 반환**: 표지·목차 페이지일 수 있음. 정상 동작.
- **OCR 힌트가 잘못된 회차로 매핑됨**: `--force`로 재호출 (Vision은 이미지의 헤더로 회차를 판단하므로 보통 자동 보정됨).
- **API 비용 우려**: `--limit N`으로 점진적 처리. 시스템 프롬프트 캐시 적중률은 `data/cache/vision/*.json`의 `usage.cache_read_input_tokens` 필드로 확인.

<#
  run_pipeline.ps1 — 소방기사 데이터 파이프라인 원클릭 실행기 (Windows PowerShell)

  사용법:
    .\scripts\run_pipeline.ps1
    .\scripts\run_pipeline.ps1 -PdfPath "C:\path\to\원본.pdf"
    .\scripts\run_pipeline.ps1 -PdfPath "C:\path\to\원본.pdf" -Limit 5
    .\scripts\run_pipeline.ps1 -Split            # 25MB 단위로 PDF만 쪼개기
    .\scripts\run_pipeline.ps1 -SkipRender       # 이미 PNG가 있으면 렌더 건너뛰기

  이 스크립트는 다음을 차례로 수행합니다:
    1) 가상환경 .venv 생성/활성화 + 의존성 설치
    2) ANTHROPIC_API_KEY 확인 (미설정 시 입력 요청)
    3) OCR 힌트 추출  (data/normalized/2025_hints.json)
    4) PDF -> PNG 렌더 (data/cache/pages/)
    5) Vision 추출    (data/cache/vision/)
    6) 데이터셋 빌드   (data/normalized/2025.json)
#>

param(
  [string]$PdfPath,
  [int]$Limit = 0,
  [int]$MaxMb = 25,
  [switch]$Split,
  [switch]$SkipRender,
  [switch]$SkipVision
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
Write-Host "Working dir: $repo" -ForegroundColor Cyan

# 1) 가상환경
$venv = Join-Path $repo ".venv"
if (-not (Test-Path $venv)) {
  Write-Host "[1/6] Creating venv..." -ForegroundColor Yellow
  python -m venv $venv
}
$activate = Join-Path $venv "Scripts\Activate.ps1"
. $activate
Write-Host "[1/6] Installing requirements..." -ForegroundColor Yellow
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r scripts\requirements.txt

# 2) API 키 (Vision 단계에만 필요)
if (-not $SkipVision) {
  if (-not $env:ANTHROPIC_API_KEY) {
    Write-Host "ANTHROPIC_API_KEY가 설정되지 않았습니다." -ForegroundColor Red
    $secure = Read-Host -AsSecureString "Anthropic API 키 (sk-ant-...)를 입력하세요"
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:ANTHROPIC_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# PDF 경로 입력
if (-not $PdfPath) {
  $PdfPath = Read-Host "원본 PDF의 전체 경로를 입력하세요 (예: C:\...\원본.pdf)"
}
if (-not (Test-Path $PdfPath)) {
  Write-Host "PDF를 찾을 수 없습니다: $PdfPath" -ForegroundColor Red
  exit 1
}

# 분할 전용 모드
if ($Split) {
  Write-Host "[Split] $PdfPath -> ${MaxMb}MB 단위 분할" -ForegroundColor Yellow
  python scripts\split_pdf.py "$PdfPath" --max-mb $MaxMb
  Write-Host "Split done." -ForegroundColor Green
  exit 0
}

# 3) OCR 힌트
Write-Host "[2/6] Extracting OCR hints..." -ForegroundColor Yellow
python scripts\extract_hints.py

# 4) 페이지 렌더
if (-not $SkipRender) {
  Write-Host "[3/6] Rendering PDF pages to PNG..." -ForegroundColor Yellow
  python scripts\render_pages.py "$PdfPath"
} else {
  Write-Host "[3/6] Skipped (use existing PNGs)" -ForegroundColor DarkGray
}

# 5) Vision 추출
if (-not $SkipVision) {
  $args = @()
  if ($Limit -gt 0) { $args += @("--limit", $Limit) }
  Write-Host "[4/6] Calling Claude Vision (this is the expensive step)..." -ForegroundColor Yellow
  python scripts\vision_extract.py @args
} else {
  Write-Host "[4/6] Skipped" -ForegroundColor DarkGray
}

# 6) 빌드
Write-Host "[5/6] Building normalized dataset..." -ForegroundColor Yellow
python scripts\build_dataset.py

Write-Host "[6/6] Done." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - 검증 통과 시: git add data\normalized\2025.json && git commit && git push"
Write-Host "  - UI 실행:      npm install (최초만) && npm run dev"
Write-Host "  - 부분 처리:    .\scripts\run_pipeline.ps1 -Limit 5 -PdfPath '$PdfPath'"

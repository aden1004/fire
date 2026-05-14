<#
  run_pipeline.ps1 - Fire exam data pipeline (Windows PowerShell)

  Usage:
    .\scripts\run_pipeline.ps1 -PdfPath "C:\path\to\source.pdf"
    .\scripts\run_pipeline.ps1 -PdfPath "..." -Limit 5
    .\scripts\run_pipeline.ps1 -PdfPath "..." -Split
    .\scripts\run_pipeline.ps1 -SkipRender   # if PNGs already exist
    .\scripts\run_pipeline.ps1 -SkipVision   # build dataset from existing cache

  Steps:
    1) Create/activate venv and install requirements
    2) Verify ANTHROPIC_API_KEY (prompts if missing)
    3) Extract OCR hints
    4) Render PDF pages to PNG
    5) Call Claude Vision per page
    6) Build normalized dataset
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

# 1) venv
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

# 2) API key (needed for Vision step)
if (-not $SkipVision) {
  if (-not $env:ANTHROPIC_API_KEY) {
    Write-Host "ANTHROPIC_API_KEY is not set." -ForegroundColor Red
    $secure = Read-Host -AsSecureString "Enter your Anthropic API key (sk-ant-...)"
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:ANTHROPIC_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# PDF path
if (-not $PdfPath) {
  $PdfPath = Read-Host "Enter full path to source PDF"
}
if (-not (Test-Path $PdfPath)) {
  Write-Host "PDF not found: $PdfPath" -ForegroundColor Red
  exit 1
}

# Split-only mode
if ($Split) {
  Write-Host "[Split] $PdfPath -> chunks under $MaxMb MB" -ForegroundColor Yellow
  python scripts\split_pdf.py "$PdfPath" --max-mb $MaxMb
  Write-Host "Split done." -ForegroundColor Green
  exit 0
}

# 3) OCR hints
Write-Host "[2/6] Extracting OCR hints..." -ForegroundColor Yellow
python scripts\extract_hints.py

# 4) Render pages
if (-not $SkipRender) {
  Write-Host "[3/6] Rendering PDF pages to PNG..." -ForegroundColor Yellow
  python scripts\render_pages.py "$PdfPath"
} else {
  Write-Host "[3/6] Skipped (use existing PNGs)" -ForegroundColor DarkGray
}

# 5) Vision extraction
if (-not $SkipVision) {
  $extra = @()
  if ($Limit -gt 0) { $extra += @("--limit", $Limit) }
  Write-Host "[4/6] Calling Claude Vision (this is the expensive step)..." -ForegroundColor Yellow
  python scripts\vision_extract.py @extra
} else {
  Write-Host "[4/6] Skipped" -ForegroundColor DarkGray
}

# 6) Build dataset
Write-Host "[5/6] Building normalized dataset..." -ForegroundColor Yellow
python scripts\build_dataset.py

Write-Host "[6/6] Done." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Commit dataset:  git add data\normalized\2025.json"
Write-Host "                     git commit -m 'Add 2025 dataset'"
Write-Host "                     git push"
Write-Host "  - Run UI:          npm install   (first time)"
Write-Host "                     npm run dev"
Write-Host "  - Partial Vision:  .\scripts\run_pipeline.ps1 -Limit 5 -PdfPath '$PdfPath'"

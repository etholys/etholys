Param(
  [switch]$NoVenv
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Arquivo .env criado a partir de .env.example"
}

python preflight_check.py local
if ($LASTEXITCODE -ne 0) {
  throw "Preflight check failed"
}

if ($NoVenv) {
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
  python -m uvicorn main:app --host 0.0.0.0 --port 8000
  exit $LASTEXITCODE
}

if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

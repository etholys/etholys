$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Arquivo .env criado a partir de .env.example"
}

python preflight_check.py docker
if ($LASTEXITCODE -ne 0) {
  throw "Preflight check failed"
}

docker compose up -d --build
Write-Host "Etholys API iniciada em http://localhost:8000"

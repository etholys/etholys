# Restaura ficheiros do ecossistema (NEXUS, PRISM, workspace, etc.)
# a partir do Local History do Cursor.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/restore-from-cursor-history.ps1

$ErrorActionPreference = 'Stop'
$HistoryRoot = Join-Path $env:APPDATA 'Cursor\User\History'
$ProjectRoot = 'C:\Users\rezen\OneDrive\Desktop\Etholys\apps\web'

# Evitar versões muito recentes que podem ser o schema/páginas "emagrecidos"
$MaxGoodTimestamp = 1778500000000

$PathPattern = [regex]'(?i)(\\hub\\(nexus|prism|forge|workspace|setup|carta)(\\|$)|\\api\\(nexus|workspace|prism|company-memory|ai\\advisor)(\\|$)|\\lib\\(nexus|integrated-workspace|ai-advisor|company-context)|\\components\\(nexus|hub|workspace)|\\components\\ui\\StateBlocks|\\tests\\nexus|\\hooks\\useNexus|\\prisma\\schema\.prisma$|\\app\\hub\\page\.tsx$)'

function Decode-ResourcePath([string]$resource) {
  $raw = $resource -replace '^file:///', ''
  $raw = [uri]::UnescapeDataString($raw)
  $raw = $raw -replace '/', '\'
  if ($raw -match '^[a-zA-Z]:\\') { return $raw }
  return $null
}

function Get-BestEntry($entries) {
  $good = @($entries | Where-Object { $_.timestamp -lt $MaxGoodTimestamp })
  if ($good.Count -gt 0) {
    return $good | Sort-Object { [long]$_.timestamp } -Descending | Select-Object -First 1
  }
  return $entries | Sort-Object { [long]$_.timestamp } -Descending | Select-Object -First 1
}

$restored = @()
$skipped = @()

Get-ChildItem -Path $HistoryRoot -Recurse -Filter 'entries.json' -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $meta = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    return
  }

  $destPath = Decode-ResourcePath $meta.resource
  if (-not $destPath) { return }
  if ($destPath -notlike "$ProjectRoot*") { return }
  if (-not $PathPattern.IsMatch($destPath)) { return }
  if (-not $meta.entries -or $meta.entries.Count -eq 0) { return }

  $entry = Get-BestEntry $meta.entries
  $srcPath = Join-Path $_.DirectoryName $entry.id
  if (-not (Test-Path -LiteralPath $srcPath)) {
    $skipped += "MISSING SNAPSHOT: $destPath ($($entry.id))"
    return
  }

  $destDir = Split-Path -Parent $destPath
  if (-not (Test-Path -LiteralPath $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }

  Copy-Item -LiteralPath $srcPath -Destination $destPath -Force
  $rel = $destPath.Substring($ProjectRoot.Length).TrimStart('\')
  $restored += $rel
}

$manifest = Join-Path (Split-Path (Split-Path $ProjectRoot -Parent) -Parent) 'scripts\restore-cursor-manifest.txt'
$restored | Sort-Object -Unique | Set-Content -LiteralPath $manifest -Encoding UTF8

Write-Host ""
Write-Host "=== Restauro Cursor Local History ===" -ForegroundColor Cyan
Write-Host "Ficheiros restaurados: $($restored | Sort-Object -Unique | Measure-Object | Select-Object -ExpandProperty Count)"
Write-Host "Lista: $manifest"
if ($skipped.Count -gt 0) {
  Write-Host "Avisos ($($skipped.Count)):" -ForegroundColor Yellow
  $skipped | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
}
Write-Host ""
Write-Host "Proximo passo na pasta apps/web:" -ForegroundColor Green
Write-Host "  npx prisma generate"
Write-Host "  (reiniciar docker compose web se estiver a correr)"

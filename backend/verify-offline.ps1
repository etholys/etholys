Param(
  [Parameter(Mandatory = $true)]
  [string]$ArchivePath,

  [string]$ChecksumPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ArchivePath)) {
  throw "Arquivo não encontrado: $ArchivePath"
}

if (-not $ChecksumPath) {
  $ChecksumPath = "$ArchivePath.sha256"
}

if (-not (Test-Path $ChecksumPath)) {
  throw "Checksum não encontrado: $ChecksumPath"
}

$line = (Get-Content $ChecksumPath | Select-Object -First 1).Trim()
if (-not $line) {
  throw "Arquivo de checksum vazio"
}

$expected = ($line -split '\s+')[0].ToLower()
$actual = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLower()

if ($expected -ne $actual) {
  throw "Checksum inválido. expected=$expected actual=$actual"
}

Write-Host "Checksum válido para $ArchivePath"

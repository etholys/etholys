param(
    [switch]$Commit,
    [string]$Message = "chore: backend scoped release update"
)

$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot

try {
    # Stage only backend and backend CI workflows.
    git add backend .github/workflows/backend-smoke.yml .github/workflows/backend-publish.yml

    $stagedFiles = git diff --cached --name-only
    if (-not $stagedFiles) {
        Write-Host "No staged files in backend release scope."
        exit 0
    }

    Write-Host "Staged files in backend release scope:"
    $stagedFiles | ForEach-Object { Write-Host " - $_" }

    if ($Commit) {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
        Write-Host "Commit created. Run 'git push origin main' when ready."
    }
    else {
        Write-Host "Preview only. Re-run with -Commit to create commit."
    }
}
finally {
    Pop-Location
}

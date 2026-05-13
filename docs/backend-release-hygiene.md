# Backend Release Hygiene

This guide keeps backend releases safe when the repository has many unrelated changes.

## 1) Stage backend scope only

Use the helper script:

```powershell
./scripts/safe-backend-release.ps1
```

To create commit directly after preview:

```powershell
./scripts/safe-backend-release.ps1 -Commit -Message "chore: backend scoped update"
```

## 2) Stash non-backend noise (optional)

Preview selective stash command:

```powershell
./scripts/stash-non-backend-noise.ps1
```

Apply selective stash (keeps backend and backend CI workflows in working tree):

```powershell
./scripts/stash-non-backend-noise.ps1 -Apply
```

## 3) Validate clean backend scope

```powershell
git status --short backend .github/workflows/backend-smoke.yml .github/workflows/backend-publish.yml
```

## 4) Publish

```powershell
git push origin main
```

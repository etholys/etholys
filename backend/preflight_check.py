import os
import shutil
import sys
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _require(cmd: str, errors: list[str]) -> None:
    if shutil.which(cmd) is None:
        errors.append(f"Missing required command: {cmd}")


def _validate_required_env(errors: list[str], warnings: list[str]) -> None:
    provider = (os.environ.get("AI_PROVIDER") or "gemini").strip().lower()
    if provider not in {"gemini", "openai", "ollama"}:
        errors.append("AI_PROVIDER must be one of: gemini, openai, ollama")

    if provider == "gemini" and not (os.environ.get("GEMINI_API_KEY") or "").strip():
        errors.append("GEMINI_API_KEY is required when AI_PROVIDER=gemini")

    if provider == "openai" and not (os.environ.get("OPENAI_API_KEY") or "").strip():
        errors.append("OPENAI_API_KEY is required when AI_PROVIDER=openai")

    if provider == "ollama":
        if not (os.environ.get("OLLAMA_BASE_URL") or "").strip():
            errors.append("OLLAMA_BASE_URL is required when AI_PROVIDER=ollama")
        if not (os.environ.get("OLLAMA_MODEL") or "").strip():
            errors.append("OLLAMA_MODEL is required when AI_PROVIDER=ollama")

    if not (os.environ.get("API_ADMIN_TOKEN") or "").strip():
        warnings.append("API_ADMIN_TOKEN is not set; admin endpoints will be unavailable")


def main() -> int:
    root = Path(__file__).resolve().parent
    _load_dotenv(root / ".env")

    errors: list[str] = []
    warnings: list[str] = []

    mode = (sys.argv[1] if len(sys.argv) > 1 else "docker").strip().lower()
    if mode not in {"docker", "local"}:
        errors.append("Mode must be 'docker' or 'local'")

    if mode == "docker":
        _require("docker", errors)
    else:
        _require("python", warnings)

    _validate_required_env(errors, warnings)

    for item in warnings:
        print(f"[preflight][warning] {item}")

    if errors:
        for item in errors:
            print(f"[preflight][error] {item}")
        return 1

    print("[preflight] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

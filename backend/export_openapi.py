import json
from pathlib import Path

from main import app


def main() -> None:
    target = Path(__file__).resolve().parent / "integrations" / "openapi" / "etholys-openapi.json"
    target.parent.mkdir(parents=True, exist_ok=True)

    spec = app.openapi()
    target.write_text(json.dumps(spec, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    print(f"OpenAPI exported to: {target}")


if __name__ == "__main__":
    main()

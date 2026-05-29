import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    parts = []
    for node in root.iter():
        if node.tag == f"{W_NS}t" and node.text:
            parts.append(node.text)
        if node.tag == f"{W_NS}tab":
            parts.append("\t")
        if node.tag in (f"{W_NS}p", f"{W_NS}br"):
            parts.append("\n")
    text = "".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main() -> None:
    base = Path(sys.argv[1])
    for p in sorted(base.glob("*.docx")):
        t = docx_text(p)
        out = base / f"{p.stem}.txt"
        out.write_text(t, encoding="utf-8")
        print(f"{p.name}: {len(t)} chars -> {out.name}")


if __name__ == "__main__":
    main()

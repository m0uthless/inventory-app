"""wiki/management/_import_common.py — utility condivise dai comandi di import wiki.

Non è un management command (niente Command qui): è importato da
import_wiki_bundle, import_wiki_queries e cleanup_wiki_import.
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path, PurePosixPath


def coerce_scalar(value: str):
    v = value.strip().strip('"').strip("'")
    if v.lower() == "true":
        return True
    if v.lower() == "false":
        return False
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    return v


def parse_frontmatter(raw_text: str) -> tuple[dict, str]:
    """Parser minimale per il frontmatter YAML-like usato nei pacchetti.

    Supporta: scalari `chiave: valore` (anche tra apici singoli/doppi),
    liste su più righe (`chiave:` seguito da righe `  - valore`), booleani
    true/false, interi. Non è un parser YAML completo: è volutamente
    ristretto al formato noto dei pacchetti generati, per non introdurre
    una dipendenza da PyYAML non presente in requirements.
    """
    text = raw_text.lstrip("\ufeff")
    if not text.startswith("---"):
        return {}, raw_text

    lines = text.splitlines()
    if lines[0].strip() != "---":
        return {}, raw_text

    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        return {}, raw_text

    fm_lines = lines[1:end_idx]
    body = "\n".join(lines[end_idx + 1:]).lstrip("\n")

    data: dict = {}
    current_list_key = None
    for line in fm_lines:
        if not line.strip():
            continue
        if line.startswith("  - ") or line.startswith("    - "):
            if current_list_key is not None:
                value = line.split("- ", 1)[1].strip()
                data.setdefault(current_list_key, []).append(coerce_scalar(value))
            continue
        m = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line)
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip()
        if value == "":
            current_list_key = key
            data[key] = []
        else:
            current_list_key = None
            data[key] = coerce_scalar(value)
    return data, body


class SourceReader:
    """Espone in modo uniforme file da una cartella o da uno zip."""

    def __init__(self, root: Path):
        self.root = root
        self.is_zip = root.is_file() and root.suffix.lower() == ".zip"
        self._zip: zipfile.ZipFile | None = None
        if self.is_zip:
            self._zip = zipfile.ZipFile(root, "r")

    def _iter_names(self):
        if self.is_zip:
            return self._zip.namelist()
        return [str(p.relative_to(self.root)) for p in self.root.rglob("*") if p.is_file()]

    def files_in(self, subdir_name: str, suffix: str) -> list[str]:
        """Nomi (relativi) dei file con estensione `suffix` la cui cartella
        diretta si chiama `subdir_name` (es. 'wiki', 'items', 'sql')."""
        return sorted(
            n for n in self._iter_names()
            if PurePosixPath(n).parent.name == subdir_name and n.endswith(suffix)
        )

    def read_text(self, name: str) -> str:
        if self.is_zip:
            return self._zip.read(name).decode("utf-8")
        return (self.root / name).read_text(encoding="utf-8")

    def read_bytes(self, name: str) -> bytes:
        if self.is_zip:
            return self._zip.read(name)
        return (self.root / name).read_bytes()

    def find_in(self, filename: str, subdir_name: str) -> str | None:
        """Trova il path relativo di `filename` dentro una cartella `subdir_name`."""
        for n in self._iter_names():
            if PurePosixPath(n).name == filename and PurePosixPath(n).parent.name == subdir_name:
                return n
        return None

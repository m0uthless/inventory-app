"""Passi di procedura ricavati dal Markdown di un articolo Wiki.

Usati dalla scheda della issue («Procedura»): se l'articolo contiene una lista di
attività (``- [ ] passo``) quella è la procedura; altrimenti si usa il primo elenco
numerato (``1. passo``). Il testo viene ripulito dalla formattazione Markdown più
comune, così da poter essere mostrato come semplice etichetta.
"""
from __future__ import annotations

import re

MAX_STEPS = 40

_TASK = re.compile(r"^\s{0,6}[-*+]\s+\[[ xX]\]\s+(?P<t>.+?)\s*$")
_ORDERED = re.compile(r"^\s{0,3}\d{1,3}[.)]\s+(?P<t>.+?)\s*$")
_FENCE = re.compile(r"^\s*(```|~~~)")
_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
_EMPH = re.compile(r"(\*\*|__|\*|_|`|~~)")


def _clean(text: str) -> str:
    text = _LINK.sub(r"\1", text)
    text = _EMPH.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def procedure_steps(markdown: str | None) -> list[str]:
    """Restituisce i passi (testo) della procedura, senza duplicati, al massimo ``MAX_STEPS``."""
    if not markdown:
        return []
    tasks: list[str] = []
    ordered: list[list[str]] = []
    current: list[str] | None = None
    in_fence = False
    for line in markdown.splitlines():
        if _FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _TASK.match(line)
        if m:
            tasks.append(_clean(m.group("t")))
            continue
        m = _ORDERED.match(line)
        if m:
            if current is None:
                current = []
                ordered.append(current)
            current.append(_clean(m.group("t")))
        elif line.strip():
            # Una riga indentata (continuazione del punto) non chiude l'elenco.
            if not line.startswith((" ", "\t")):
                current = None
    chosen = tasks or (ordered[0] if ordered else [])
    out: list[str] = []
    for step in chosen:
        if step and step not in out:
            out.append(step)
        if len(out) >= MAX_STEPS:
            break
    return out

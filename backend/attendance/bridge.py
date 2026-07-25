"""attendance/bridge.py — Ponte fascia (MAT/POM) ↔ orario.

Regola unica basata sulla soglia 13:00 (pausa 13–14 esclusa), indipendente
dall'orario del singolo tecnico:
  • intervallo con inizio < 13:00 → tocca la MATTINA;
  • intervallo con fine   ≥ 14:00 → tocca il POMERIGGIO.
Un permesso orario inserito in ServiceNow si aggancia così automaticamente
alla/e mezza/e giornata/e corretta/e del Piano Ferie; ferie/104/malattia
inserite nel Piano Ferie compaiono in ServiceNow come slot canonico.
"""
from datetime import time

from .models import AFTERNOON_START, NOON_THRESHOLD, DayPart


def day_parts_for_hours(time_from: time, time_to: time) -> list[str]:
    """Fasce toccate da un intervallo orario. Ritorna [] impossibile:
    almeno una fascia è sempre restituita."""
    parts: list[str] = []
    if time_from < NOON_THRESHOLD:
        parts.append(DayPart.MATTINA)
    if time_to > AFTERNOON_START:
        parts.append(DayPart.POMERIGGIO)
    if not parts:
        # Intervallo interamente nella pausa 13–14 (caso limite): mattina.
        parts.append(DayPart.MATTINA)
    return parts


def day_part_covers_now(day_part: str, now_time: time) -> bool:
    """Se la fascia (a livello di mezza giornata, senza orario) copre l'istante
    corrente. Split sulla soglia 13:00: prima → mattina, dopo → pomeriggio."""
    if now_time < NOON_THRESHOLD:
        return day_part == DayPart.MATTINA
    return day_part == DayPart.POMERIGGIO

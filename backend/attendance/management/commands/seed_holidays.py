"""attendance/management/commands/seed_holidays.py — Inserisce le festività
nazionali italiane (fisse + Pasqua/Pasquetta, mobili) per un intervallo di
anni nel Piano Ferie.

Idempotente: usa `update_or_create` su (date, label) — rilanciarlo non crea
doppioni e riattiva eventuali righe soft-deleted con lo stesso date+label.

Non tocca le festività locali/per-area (patrono, chiusure di uno
stabilimento specifico): quelle restano gestite a mano da Django admin
(Holiday.areas valorizzato — vuoto invece = vale per tutte le aree, come
quelle inserite da questo comando).

Uso:
    python manage.py seed_holidays
        → di default 2026-2030
    python manage.py seed_holidays --from-year 2031 --to-year 2031
        → un singolo anno futuro
"""
from datetime import date

from django.core.management.base import BaseCommand

from attendance.models import Holiday

DEFAULT_FROM_YEAR = 2026
DEFAULT_TO_YEAR = 2030

# Festività nazionali italiane a data fissa: (mese, giorno, etichetta).
FIXED_HOLIDAYS = [
    (1, 1, "Capodanno"),
    (1, 6, "Epifania"),
    (4, 25, "Anniversario della Liberazione"),
    (5, 1, "Festa dei Lavoratori"),
    (6, 2, "Festa della Repubblica"),
    (8, 15, "Ferragosto"),
    (11, 1, "Ognissanti"),
    (12, 8, "Immacolata Concezione"),
    (12, 25, "Natale"),
    (12, 26, "Santo Stefano"),
]


def easter_sunday(year: int) -> date:
    """Domenica di Pasqua (calendario gregoriano) — algoritmo anonimo di
    Gauss. Usata solo per calcolare Pasquetta (lunedì successivo), unica
    festività mobile fra quelle nazionali italiane."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


class Command(BaseCommand):
    help = (
        "Inserisce le festività nazionali italiane (fisse + Pasqua/Pasquetta) "
        f"per l'intervallo di anni indicato (default {DEFAULT_FROM_YEAR}-{DEFAULT_TO_YEAR}). "
        "Idempotente, non tocca le festività locali/per-area."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--from-year", type=int, default=DEFAULT_FROM_YEAR,
            help=f"Anno iniziale incluso (default {DEFAULT_FROM_YEAR}).",
        )
        parser.add_argument(
            "--to-year", type=int, default=DEFAULT_TO_YEAR,
            help=f"Anno finale incluso (default {DEFAULT_TO_YEAR}).",
        )

    def handle(self, *args, **options):
        from_year = options["from_year"]
        to_year = options["to_year"]
        if to_year < from_year:
            self.stderr.write(self.style.ERROR("--to-year deve essere >= --from-year"))
            return

        created = 0
        updated = 0
        for year in range(from_year, to_year + 1):
            entries = [(date(year, month, day), label) for (month, day, label) in FIXED_HOLIDAYS]
            easter = easter_sunday(year)
            pasquetta = date.fromordinal(easter.toordinal() + 1)
            entries.append((pasquetta, "Lunedì dell'Angelo (Pasquetta)"))

            for holiday_date, label in sorted(entries):
                _, was_created = Holiday.objects.update_or_create(
                    date=holiday_date, label=label, defaults={"deleted_at": None},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Festività {from_year}-{to_year}: {created} create, {updated} già presenti (invariate)."
        ))

import csv
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from crm.models import Customer
from core.models import CustomerStatus


def _as_str(v):
    if v is None:
        return None
    v = str(v).strip()
    return v if v != "" else None


def _parse_tags(v):
    v = _as_str(v)
    if not v:
        return None
    sep = ";" if ";" in v else ","
    tags = [t.strip() for t in v.split(sep) if t.strip()]
    return tags or None


def _parse_json(v):
    v = _as_str(v)
    if not v:
        return None
    try:
        return json.loads(v)
    except json.JSONDecodeError:
        return {"raw": v}


class Command(BaseCommand):
    help = "Import Customers from CSV. Supports status_key/status (key) or status_id (int)."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="e.g. /app/data/customers.csv")
        parser.add_argument("--delimiter", type=str, default=None, help="Force delimiter: , or ;")
        parser.add_argument("--dry-run", action="store_true", help="Validate only, rollback at end")

    def handle(self, *args, **options):
        csv_path = Path(options["csv_path"])
        if not csv_path.exists():
            raise CommandError(f"CSV non trovato: {csv_path}")

        delimiter = options["delimiter"]
        dry_run = options["dry_run"]

        created = updated = skipped = errors = 0

        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            sample = f.read(4096)
            f.seek(0)

            if delimiter is None:
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
                    delimiter = dialect.delimiter
                except Exception:
                    delimiter = ","

            reader = csv.DictReader(f, delimiter=delimiter)

            required = {"name"}
            missing = required - set(reader.fieldnames or [])
            if missing:
                raise CommandError(f"CSV mancante colonne richieste: {missing}. Colonne trovate: {reader.fieldnames}")

            status_map = {s.key: s for s in CustomerStatus.objects.filter(deleted_at__isnull=True)}

            def resolve_status(row):
                sid = _as_str(row.get("status_id"))
                sk = _as_str(row.get("status_key")) or _as_str(row.get("status"))

                if sid and sid.isdigit():
                    return CustomerStatus.objects.get(id=int(sid))

                if not sk:
                    sk = "active"

                if sk in status_map:
                    return status_map[sk]

                raise ValueError(f"status_key/status='{sk}' non valido (seed: prospect/active/on_hold/archived)")

            def find_existing(row):
                vat = _as_str(row.get("vat_number"))
                tax = _as_str(row.get("tax_code"))
                name = _as_str(row.get("name"))
                if vat:
                    return Customer.objects.filter(vat_number=vat, deleted_at__isnull=True).first()
                if tax:
                    return Customer.objects.filter(tax_code=tax, deleted_at__isnull=True).first()
                if name:
                    return Customer.objects.filter(name=name, deleted_at__isnull=True).first()
                return None

            with transaction.atomic():
                for idx, row in enumerate(reader, start=2):
                    try:
                        name = _as_str(row.get("name"))
                        if not name:
                            skipped += 1
                            continue

                        status = resolve_status(row)

                        payload = {
                            "name": name,
                            "display_name": _as_str(row.get("display_name")),
                            "vat_number": _as_str(row.get("vat_number")),
                            "tax_code": _as_str(row.get("tax_code")),
                            "status": status,
                            "notes": _as_str(row.get("notes")),
                            "tags": _parse_tags(row.get("tags")),
                            "custom_fields": _parse_json(row.get("custom_fields")),
                        }

                        existing = find_existing(row)
                        if existing:
                            for k, v in payload.items():
                                setattr(existing, k, v)
                            if not dry_run:
                                existing.save()
                            updated += 1
                        else:
                            if not dry_run:
                                Customer.objects.create(**payload)
                            created += 1

                    except Exception as e:
                        errors += 1
                        self.stderr.write(f"[Riga {idx}] ERRORE: {e} | row={row}")

                if dry_run:
                    transaction.set_rollback(True)
                    self.stdout.write(self.style.WARNING(
                        f"DRY RUN OK (rollback). created={created}, updated={updated}, skipped={skipped}, errors={errors}, delimiter='{delimiter}'"
                    ))
                    return

        self.stdout.write(self.style.SUCCESS(
            f"Import completato. created={created}, updated={updated}, skipped={skipped}, errors={errors}, delimiter='{delimiter}'"
        ))

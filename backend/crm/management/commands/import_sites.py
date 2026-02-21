import csv
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from crm.models import Site, Customer
from core.models import SiteStatus


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
    help = "Import Sites from CSV. Customer by customer_code/customer_id/customer_name. Status by status_key/status_id."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="e.g. /app/data/sites.csv")
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

            status_map = {s.key: s for s in SiteStatus.objects.filter(deleted_at__isnull=True)}

            def resolve_customer(row):
                cid = _as_str(row.get("customer_id"))
                ccode = _as_str(row.get("customer_code"))
                cname = _as_str(row.get("customer_name"))

                if cid and cid.isdigit():
                    return Customer.objects.get(id=int(cid))

                if ccode:
                    c = Customer.objects.filter(code=ccode, deleted_at__isnull=True).first()
                    if c:
                        return c
                    raise ValueError(f"customer_code='{ccode}' non trovato")

                if cname:
                    c = Customer.objects.filter(name=cname, deleted_at__isnull=True).first()
                    if c:
                        return c
                    raise ValueError(f"customer_name='{cname}' non trovato")

                raise ValueError("Manca customer_code o customer_id o customer_name")

            def resolve_status(row):
                sid = _as_str(row.get("status_id"))
                sk = _as_str(row.get("status_key")) or _as_str(row.get("status"))

                if sid and sid.isdigit():
                    return SiteStatus.objects.get(id=int(sid))

                if not sk:
                    sk = "active"

                if sk in status_map:
                    return status_map[sk]

                raise ValueError("status_key/status non valido (seed: active/temporarily_closed/archived)")

            def find_existing(customer, name):
                return Site.objects.filter(customer=customer, name=name, deleted_at__isnull=True).first()

            with transaction.atomic():
                for idx, row in enumerate(reader, start=2):
                    try:
                        name = _as_str(row.get("name"))
                        if not name:
                            skipped += 1
                            continue

                        customer = resolve_customer(row)
                        status = resolve_status(row)

                        payload = {
                            "customer": customer,
                            "name": name,
                            "status": status,
                            "address_line1": _as_str(row.get("address_line1")),
                            "city": _as_str(row.get("city")),
                            "zip": _as_str(row.get("zip")),
                            "province": _as_str(row.get("province")),
                            "country": _as_str(row.get("country")) or "IT",
                            "notes": _as_str(row.get("notes")),
                            "tags": _parse_tags(row.get("tags")),
                            "custom_fields": _parse_json(row.get("custom_fields")),
                        }

                        existing = find_existing(customer, name)
                        if existing:
                            for k, v in payload.items():
                                setattr(existing, k, v)
                            if not dry_run:
                                existing.save()
                            updated += 1
                        else:
                            if not dry_run:
                                Site.objects.create(**payload)
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

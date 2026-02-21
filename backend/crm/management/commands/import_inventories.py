import csv
import json
from pathlib import Path
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inventory.models import Inventory
from crm.models import Customer, Site
from core.models import InventoryStatus, InventoryType


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


def _parse_date(v):
    v = _as_str(v)
    if not v:
        return None
    # accetta: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Data non valida: '{v}' (usa YYYY-MM-DD oppure DD/MM/YYYY)")


class Command(BaseCommand):
    help = "Import Inventories from CSV. Customer by customer_code/customer_id/customer_name. Optional site by site_name/site_id. Status by status_key/status_id. Type by type_key/type_id."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="e.g. /app/data/inventories.csv")
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

            status_map = {s.key: s for s in InventoryStatus.objects.filter(deleted_at__isnull=True)}
            type_map = {t.key: t for t in InventoryType.objects.filter(deleted_at__isnull=True)}

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

            def resolve_site(row, customer):
                sid = _as_str(row.get("site_id"))
                sname = _as_str(row.get("site_name"))

                if sid and sid.isdigit():
                    s = Site.objects.get(id=int(sid))
                    if s.customer_id != customer.id:
                        raise ValueError(f"site_id={sid} non appartiene a customer {customer.code}")
                    return s

                if sname:
                    s = Site.objects.filter(customer=customer, name=sname, deleted_at__isnull=True).first()
                    if s:
                        return s
                    raise ValueError(f"site_name='{sname}' non trovato per customer {customer.code}")

                return None

            def resolve_status(row):
                sid = _as_str(row.get("status_id"))
                sk = _as_str(row.get("status_key")) or _as_str(row.get("status"))

                if sid and sid.isdigit():
                    return InventoryStatus.objects.get(id=int(sid))

                if not sk:
                    sk = "in_use"

                if sk in status_map:
                    return status_map[sk]

                raise ValueError("status_key/status non valido (seed: in_use/to_install/maintenance/repair/retired)")

            def resolve_type(row):
                tid = _as_str(row.get("type_id"))
                tk = _as_str(row.get("type_key")) or _as_str(row.get("type"))

                if tid and tid.isdigit():
                    return InventoryType.objects.get(id=int(tid))

                if not tk:
                    return None

                if tk in type_map:
                    return type_map[tk]

                raise ValueError(f"type_key/type '{tk}' non valido (seed inventory types)")

            def find_existing(row):
                kn = _as_str(row.get("knumber"))
                sn = _as_str(row.get("serial_number"))

                if kn:
                    obj = Inventory.objects.filter(knumber=kn, deleted_at__isnull=True).first()
                    if obj:
                        return obj
                if sn:
                    obj = Inventory.objects.filter(serial_number=sn, deleted_at__isnull=True).first()
                    if obj:
                        return obj
                return None

            with transaction.atomic():
                for idx, row in enumerate(reader, start=2):
                    try:
                        name = _as_str(row.get("name"))
                        if not name:
                            skipped += 1
                            continue

                        customer = resolve_customer(row)
                        site = resolve_site(row, customer)
                        status = resolve_status(row)
                        inv_type = resolve_type(row)

                        payload = {
                            "customer": customer,
                            "site": site,
                            "name": name,
                            "knumber": _as_str(row.get("knumber")),
                            "serial_number": _as_str(row.get("serial_number")),
                            "type": inv_type,
                            "os_user": _as_str(row.get("os_user")),
                            "os_pwd": _as_str(row.get("os_pwd")),
                            "app_usr": _as_str(row.get("app_usr")),
                            "app_pwd": _as_str(row.get("app_pwd")),
                            "vnc_pwd": _as_str(row.get("vnc_pwd")),
                            "hostname": _as_str(row.get("hostname")),
                            "local_ip": _as_str(row.get("local_ip")),
                            "srsa_ip": _as_str(row.get("srsa_ip")),
                            "status": status,
                            "manufacturer": _as_str(row.get("manufacturer")),
                            "model": _as_str(row.get("model")),
                            "warranty_end_date": _parse_date(row.get("warranty_end_date")),
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
                                Inventory.objects.create(**payload)
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

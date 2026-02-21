import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from crm.models import Contact, Customer, Site


def _as_str(v):
    if v is None:
        return None
    v = str(v).strip()
    return v if v != "" else None


def _as_bool(v):
    v = _as_str(v)
    if v is None:
        return False
    v = v.lower()
    return v in {"1", "true", "t", "yes", "y", "si", "sì", "on"}


class Command(BaseCommand):
    help = "Import Contacts from CSV. Customer by customer_code/customer_id/customer_name. Optional site by site_name/site_id."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="e.g. /app/data/contacts.csv")
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
                # opzionale
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

            def find_existing(customer, site, row):
                email = _as_str(row.get("email"))
                name = _as_str(row.get("name"))
                phone = _as_str(row.get("phone"))

                qs = Contact.objects.filter(customer=customer, site=site, deleted_at__isnull=True)
                if email:
                    return qs.filter(email=email).first()
                if name and phone:
                    return qs.filter(name=name, phone=phone).first()
                if name:
                    return qs.filter(name=name).first()
                return None

            def enforce_primary(customer, site, keep_contact_id=None):
                qs = Contact.objects.filter(customer=customer, site=site, deleted_at__isnull=True, is_primary=True)
                if keep_contact_id:
                    qs = qs.exclude(id=keep_contact_id)
                if not dry_run:
                    qs.update(is_primary=False)

            with transaction.atomic():
                for idx, row in enumerate(reader, start=2):
                    try:
                        name = _as_str(row.get("name"))
                        if not name:
                            skipped += 1
                            continue

                        customer = resolve_customer(row)
                        site = resolve_site(row, customer)

                        is_primary = _as_bool(row.get("is_primary"))

                        payload = {
                            "customer": customer,
                            "site": site,
                            "name": name,
                            "email": _as_str(row.get("email")),
                            "phone": _as_str(row.get("phone")),
                            "role_department": _as_str(row.get("role_department")) or _as_str(row.get("role")) or _as_str(row.get("department")),
                            "is_primary": is_primary,
                            "notes": _as_str(row.get("notes")),
                        }

                        existing = find_existing(customer, site, row)
                        if existing:
                            for k, v in payload.items():
                                setattr(existing, k, v)
                            if not dry_run:
                                existing.save()
                                if is_primary:
                                    enforce_primary(customer, site, keep_contact_id=existing.id)
                            updated += 1
                        else:
                            if not dry_run:
                                obj = Contact.objects.create(**payload)
                                if is_primary:
                                    enforce_primary(customer, site, keep_contact_id=obj.id)
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

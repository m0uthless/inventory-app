# Generated manually - 2026-02-21
#
# Changes:
#   - Drop MaintenanceTemplate (and FK from MaintenancePlan)
#   - MaintenancePlan: swap inventory FK → customer FK
#   - MaintenancePlan: remove template, tech, last_done_date fields
#   - MaintenancePlan: add M2M inventory_types
#   - MaintenanceEvent: plan becomes non-nullable
#   - MaintenanceNotification: update unique constraint (add inventory)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("maintenance", "0002_alter_maintenanceevent_options_and_more"),
        ("crm", "0001_initial"),
        ("core", "0001_initial"),
        ("inventory", "0001_initial"),
    ]

    operations = [
        # ── 1. Rendi plan nullable su MaintenanceEvent temporaneamente (già lo è) ──
        # (plan era già null=True, blank=True — nessuna azione necessaria)

        # ── 2. Rimuovi FK template da MaintenancePlan ──────────────────────────────
        migrations.RemoveField(
            model_name="maintenanceplan",
            name="template",
        ),

        # ── 3. Rimuovi FK tech da MaintenancePlan ──────────────────────────────────
        migrations.RemoveField(
            model_name="maintenanceplan",
            name="tech",
        ),

        # ── 4. Rimuovi last_done_date da MaintenancePlan ───────────────────────────
        migrations.RemoveField(
            model_name="maintenanceplan",
            name="last_done_date",
        ),

        # ── 5. Rimuovi FK inventory da MaintenancePlan ─────────────────────────────
        migrations.RemoveField(
            model_name="maintenanceplan",
            name="inventory",
        ),

        # ── 6. Aggiungi FK customer su MaintenancePlan ─────────────────────────────
        #       default temporaneo = 1 per righe esistenti (se presenti)
        migrations.AddField(
            model_name="maintenanceplan",
            name="customer",
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="maintenance_plans",
                to="crm.customer",
            ),
            preserve_default=False,
        ),

        # ── 7. Aggiungi M2M inventory_types su MaintenancePlan ─────────────────────
        migrations.AddField(
            model_name="maintenanceplan",
            name="inventory_types",
            field=models.ManyToManyField(
                related_name="maintenance_plans",
                to="core.inventorytype",
            ),
        ),

        # ── 8. Rendi plan obbligatorio su MaintenanceEvent ────────────────────────
        migrations.AlterField(
            model_name="maintenanceevent",
            name="plan",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="events",
                to="maintenance.maintenanceplan",
            ),
        ),

        # ── 9. Rimuovi old unique constraint su MaintenanceNotification ───────────
        migrations.RemoveConstraint(
            model_name="maintenancenotification",
            name="ux_maint_notif_plan_due_active",
        ),

        # ── 10. Aggiungi nuovo unique constraint (plan + inventory + due_date) ──────
        migrations.AddConstraint(
            model_name="maintenancenotification",
            constraint=models.UniqueConstraint(
                fields=["plan", "inventory", "due_date"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_maint_notif_plan_inv_due_active",
            ),
        ),

        # ── 11. Drop MaintenanceTemplate ───────────────────────────────────────────
        migrations.DeleteModel(
            name="MaintenanceTemplate",
        ),
    ]

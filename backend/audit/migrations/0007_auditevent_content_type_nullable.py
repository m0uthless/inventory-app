"""
Migration 0007 — AuditEvent.content_type nullable

Motivo: log_event() può essere chiamata con instance=None (es. eventi di sistema
come login/logout privi di un oggetto target). Con content_type NOT NULL il
INSERT falliva silenziosamente (eccezione swallowed da AUDIT_STRICT=0).

Modifiche:
- content_type: FK → nullable (null=True, blank=True)
- object_id: rimuove il vincolo NOT NULL esplicito (blank=True, default="")
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0006_auditevent_metadata"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        # Rendi content_type nullable
        migrations.AlterField(
            model_name="auditevent",
            name="content_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to="contenttypes.contenttype",
            ),
        ),
        # Assicura che object_id abbia un default (era già CharField ma senza default)
        migrations.AlterField(
            model_name="auditevent",
            name="object_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
from django.contrib.postgres.fields import ArrayField


class Migration(migrations.Migration):

    dependencies = [
        ("wiki", "0006_wikipage_created_by_updated_by"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="WikiPageRevision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("revision_number", models.PositiveIntegerField()),
                ("title", models.CharField(max_length=255)),
                ("summary", models.TextField(blank=True, null=True)),
                ("tags", ArrayField(models.TextField(), blank=True, null=True)),
                ("content_markdown", models.TextField()),
                ("saved_at", models.DateTimeField(auto_now_add=True)),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="revisions",
                        to="wiki.wikipage",
                    ),
                ),
                (
                    "saved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Revisione",
                "verbose_name_plural": "Revisioni",
                "ordering": ["-revision_number"],
            },
        ),
        migrations.AddConstraint(
            model_name="wikipagerevision",
            constraint=models.UniqueConstraint(
                fields=["page", "revision_number"],
                name="ux_wiki_revision_page_num",
            ),
        ),
    ]

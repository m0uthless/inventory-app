from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("issues", "0005_issue_inventory"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="closed_at",
            field=models.DateField(blank=True, null=True, verbose_name="Data chiusura"),
        ),
    ]

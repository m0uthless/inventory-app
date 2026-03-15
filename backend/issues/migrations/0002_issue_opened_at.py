from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("issues", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="opened_at",
            field=models.DateField(
                blank=True, null=True, verbose_name="Data apertura"
            ),
        ),
    ]

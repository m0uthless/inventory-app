from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wiki", "0007_wikipagerevision"),
    ]

    operations = [
        migrations.AddField(
            model_name="wikipage",
            name="kb_code",
            field=models.CharField(max_length=16, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="wikipage",
            name="view_count",
            field=models.PositiveBigIntegerField(default=0),
        ),
    ]

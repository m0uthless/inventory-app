from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wiki", "0003_wikipage_parent"),
    ]

    operations = [
        migrations.AddField(
            model_name="wikicategory",
            name="emoji",
            field=models.CharField(max_length=8, blank=True, default="📄"),
        ),
        migrations.AddField(
            model_name="wikicategory",
            name="color",
            field=models.CharField(max_length=16, blank=True, default="#0f766e"),
        ),
        migrations.AddField(
            model_name="wikiattachment",
            name="file",
            field=models.FileField(
                upload_to="wiki_attachments/",
                null=True,
                blank=True,
            ),
        ),
    ]

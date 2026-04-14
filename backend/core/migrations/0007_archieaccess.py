from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_usertask"),
    ]

    operations = [
        migrations.CreateModel(
            name="ArchieAccess",
            fields=[],
            options={
                "managed": False,
                "default_permissions": (),
                "permissions": [("access_archie", "Può accedere al frontend Archie")],
            },
        ),
    ]

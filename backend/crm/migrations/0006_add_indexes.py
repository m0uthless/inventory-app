from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0005_customer_site_contact_userstamps"),
    ]

    operations = [
        # Customer
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["deleted_at"], name="cust_deleted_at_idx"),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["updated_at"], name="cust_updated_at_idx"),
        ),
        # Site
        migrations.AddIndex(
            model_name="site",
            index=models.Index(fields=["deleted_at"], name="site_deleted_at_idx"),
        ),
        migrations.AddIndex(
            model_name="site",
            index=models.Index(fields=["customer", "deleted_at"], name="site_customer_del_idx"),
        ),
        migrations.AddIndex(
            model_name="site",
            index=models.Index(fields=["updated_at"], name="site_updated_at_idx"),
        ),
        # Contact
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(fields=["deleted_at"], name="contact_deleted_at_idx"),
        ),
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(fields=["customer", "deleted_at"], name="contact_customer_del_idx"),
        ),
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(fields=["site", "deleted_at"], name="contact_site_del_idx"),
        ),
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(fields=["updated_at"], name="contact_updated_at_idx"),
        ),
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(fields=["customer", "site", "is_primary", "deleted_at"], name="contact_primary_idx"),
        ),
    ]

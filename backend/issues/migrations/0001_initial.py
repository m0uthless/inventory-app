from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("crm", "0006_add_indexes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="IssueCategory",
            fields=[
                ("id",         models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("key",        models.CharField(max_length=64)),
                ("label",      models.CharField(max_length=128)),
                ("sort_order", models.IntegerField(default=0)),
                ("is_active",  models.BooleanField(default=True)),
            ],
            options={"verbose_name": "Categoria issue", "verbose_name_plural": "Categorie issue", "ordering": ["sort_order", "label"]},
        ),
        migrations.CreateModel(
            name="Issue",
            fields=[
                ("id",             models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("deleted_at",     models.DateTimeField(blank=True, null=True)),
                ("created_at",     models.DateTimeField(auto_now_add=True)),
                ("updated_at",     models.DateTimeField(auto_now=True)),
                ("title",          models.CharField(max_length=255, verbose_name="Titolo")),
                ("description",    models.TextField(blank=True, verbose_name="Descrizione")),
                ("servicenow_id",  models.CharField(blank=True, max_length=100, verbose_name="Caso ServiceNow")),
                ("priority",       models.CharField(choices=[("low","Bassa"),("medium","Media"),("high","Alta"),("critical","Critica")], default="medium", max_length=20, verbose_name="Priorità")),
                ("status",         models.CharField(choices=[("open","Aperta"),("in_progress","In lavorazione"),("resolved","Risolta"),("closed","Chiusa")], default="open", max_length=20, verbose_name="Stato")),
                ("due_date",       models.DateField(blank=True, null=True, verbose_name="Scadenza")),
                ("customer",       models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,  related_name="issues",           to="crm.customer",                  verbose_name="Cliente")),
                ("site",           models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="issues", to="crm.site",         verbose_name="Sito")),
                ("category",       models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="issues", to="issues.issuecategory", verbose_name="Categoria")),
                ("assigned_to",    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_issues",  to=settings.AUTH_USER_MODEL, verbose_name="Assegnato a")),
                ("created_by",     models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,  related_name="created_issues",   to=settings.AUTH_USER_MODEL,        verbose_name="Creato da")),
            ],
            options={"verbose_name": "Issue", "verbose_name_plural": "Issues", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="IssueComment",
            fields=[
                ("id",         models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("body",       models.TextField(verbose_name="Testo")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("issue",      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,  related_name="comments",       to="issues.issue",              verbose_name="Issue")),
                ("author",     models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,  related_name="issue_comments", to=settings.AUTH_USER_MODEL,    verbose_name="Autore")),
            ],
            options={"verbose_name": "Commento issue", "verbose_name_plural": "Commenti issue", "ordering": ["created_at"]},
        ),
        migrations.AddConstraint(
            model_name="issuecategory",
            constraint=models.UniqueConstraint(condition=models.Q(deleted_at__isnull=True), fields=["key"], name="ux_issue_category_key_active"),
        ),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["status"],             name="issue_status_idx")),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["priority"],           name="issue_priority_idx")),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["customer", "status"], name="issue_customer_status_idx")),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["assigned_to"],        name="issue_assigned_idx")),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["due_date"],           name="issue_due_date_idx")),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["deleted_at"],         name="issue_deleted_at_idx")),
        migrations.AddIndex(model_name="issue", index=models.Index(fields=["-created_at"],        name="issue_created_at_idx")),
        migrations.AddIndex(model_name="issuecomment", index=models.Index(fields=["issue", "created_at"], name="issuecomment_issue_idx")),
    ]

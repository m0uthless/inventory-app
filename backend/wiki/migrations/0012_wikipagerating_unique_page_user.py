from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Fix: aggiunge UniqueConstraint su WikiPageRating(page, user) per
    garantire l'idempotenza del rating a livello database, eliminando
    la race condition check-then-act in WikiPageViewSet.rate_page().

    Usa SeparateDatabaseAndState per gestire il caso in cui il constraint
    esista già nel DB (es. applicato manualmente o da una migrazione
    precedente non tracciata): il DDL viene eseguito solo se assente,
    mentre lo stato Django viene sempre aggiornato.
    """

    dependencies = [
        ("wiki", "0011_wikiqueryLanguage_fk"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # Stato Django: registra il constraint nel migration graph
            state_operations=[
                migrations.AddConstraint(
                    model_name="wikipagerating",
                    constraint=models.UniqueConstraint(
                        fields=["page", "user"],
                        name="ux_wiki_page_rating_page_user",
                    ),
                ),
            ],
            # DDL reale: crea il constraint solo se non esiste già
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM pg_constraint
                                WHERE conname = 'ux_wiki_page_rating_page_user'
                            ) THEN
                                ALTER TABLE wiki_wikipagerating
                                ADD CONSTRAINT ux_wiki_page_rating_page_user
                                UNIQUE (page_id, user_id);
                            END IF;
                        END
                        $$;
                    """,
                    reverse_sql="""
                        ALTER TABLE wiki_wikipagerating
                        DROP CONSTRAINT IF EXISTS ux_wiki_page_rating_page_user;
                    """,
                ),
            ],
        ),
    ]

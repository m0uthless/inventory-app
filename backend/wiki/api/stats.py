"""wiki/api/stats.py — WikiStatsView (aggregated dashboard statistics)."""
from __future__ import annotations

import logging
from django.conf import settings
from django.db import models as django_models
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as drf_status

from wiki.models import WikiPage, WikiPageRating, WikiPageRevision, WikiQuery

logger = logging.getLogger(__name__)

class WikiStatsView(APIView):
    """Statistiche aggregate per la dashboard wiki.

    Il risultato viene cachato per WIKI_STATS_CACHE_TTL secondi (default 300)
    per evitare 8+ query aggregate ad ogni apertura della dashboard.
    La cache è condivisa tra tutti gli utenti (i dati non sono sensibili per
    utente). Viene invalidata automaticamente allo scadere del TTL.
    """

    permission_classes = [IsAuthenticated]
    CACHE_KEY = "wiki:stats:v1"
    CACHE_TTL = 300  # 5 minuti — sovrascrivibile via settings.WIKI_STATS_CACHE_TTL

    def get(self, request):
        from django.core.cache import cache

        ttl = getattr(settings, "WIKI_STATS_CACHE_TTL", self.CACHE_TTL)

        cached = cache.get(self.CACHE_KEY)
        if cached is not None:
            return Response(cached)

        result = self._compute_stats(request)
        # _compute_stats ritorna un Response di errore (500) oppure un dict con i dati.
        # Cachiamo solo il dict; gli errori non vengono mai cachati.
        if isinstance(result, Response):
            return result
        cache.set(self.CACHE_KEY, result, timeout=ttl)
        return Response(result)

    def _compute_stats(self, request):
        try:
            from django.db.models import Count, Sum

            pages_qs = WikiPage.objects.filter(deleted_at__isnull=True)
            rated_pages_qs = pages_qs.annotate(
                avg_rating=django_models.Avg("ratings__rating"),
                rating_count=Count("ratings", distinct=True),
            )

            rating_votes_qs = WikiPageRating.objects.filter(page__deleted_at__isnull=True)

            by_category = (
                pages_qs
                .values("category__name", "category__color", "category__emoji")
                .annotate(count=Count("id"))
                .order_by("-count", "category__name")
            )
            by_category_data = [
                {
                    "name": row["category__name"] or "Senza categoria",
                    "color": row["category__color"] or "#64748b",
                    "emoji": row["category__emoji"] or "📄",
                    "count": row["count"],
                }
                for row in by_category
            ]

            recent = rated_pages_qs.select_related("updated_by").order_by("-updated_at")[:10]
            recent_data = [
                {
                    "id": page.pk,
                    "kb_code": page.kb_code,
                    "title": page.title,
                    "updated_at": page.updated_at.isoformat() if page.updated_at else None,
                    "updated_by": (
                        f"{page.updated_by.first_name} {page.updated_by.last_name}".strip() or page.updated_by.username
                    ) if page.updated_by else None,
                    "view_count": page.view_count,
                    "is_published": page.is_published,
                    "avg_rating": round(float(page.avg_rating or 0), 2) if page.rating_count else None,
                    "rating_count": int(page.rating_count or 0),
                }
                for page in recent
            ]

            top_authors = (
                WikiPageRevision.objects
                .filter(saved_by__isnull=False)
                .values("saved_by__id", "saved_by__first_name", "saved_by__last_name", "saved_by__username")
                .annotate(edits=Count("id"))
                .order_by("-edits", "saved_by__username")[:8]
            )
            top_authors_data = [
                {
                    "user_id": row["saved_by__id"],
                    "name": (
                        f"{row['saved_by__first_name']} {row['saved_by__last_name']}".strip() or row["saved_by__username"]
                    ),
                    "edits": row["edits"],
                }
                for row in top_authors
            ]

            def serialize_page(page):
                return {
                    "id": page.pk,
                    "kb_code": page.kb_code or "",
                    "title": page.title,
                    "view_count": page.view_count,
                    "updated_at": page.updated_at.isoformat() if page.updated_at else None,
                    "is_published": page.is_published,
                    "avg_rating": round(float(page.avg_rating or 0), 2) if page.rating_count else None,
                    "rating_count": int(page.rating_count or 0),
                }

            top_rated_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.filter(rating_count__gt=0).order_by("-avg_rating", "-rating_count", "title")[:8]
            ]

            low_rated_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.filter(rating_count__gt=0).order_by("avg_rating", "-rating_count", "title")[:8]
            ]

            unrated_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.filter(rating_count=0).order_by("-updated_at", "title")[:8]
            ]

            most_viewed_pages_data = [
                serialize_page(page)
                for page in rated_pages_qs.order_by("-view_count", "title")[:8]
            ]

            distribution_rows = {
                row["rating"]: row["count"]
                for row in rating_votes_qs.values("rating").annotate(count=Count("id"))
            }
            rating_distribution = [
                {"stars": stars, "count": int(distribution_rows.get(stars, 0))}
                for stars in range(1, 6)
            ]

            totals = pages_qs.aggregate(
                total=Count("id"),
                published=Count("id", filter=django_models.Q(is_published=True)),
                drafts=Count("id", filter=django_models.Q(is_published=False)),
                total_views=Sum("view_count"),
            )
            rating_totals = rating_votes_qs.aggregate(
                total_votes=Count("id"),
                average_rating=django_models.Avg("rating"),
                rated_pages=Count("page_id", distinct=True),
            )
            rated_pages_count = int(rating_totals["rated_pages"] or 0)
            total_pages = int(totals["total"] or 0)

            # Contributor del mese: utente con più pagine create nel mese corrente
            from django.utils import timezone as tz
            now = tz.now()
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            monthly_contrib_qs = (
                WikiPage.objects
                .filter(created_at__gte=month_start, created_by__isnull=False, deleted_at__isnull=True)
                .values(
                    "created_by__id",
                    "created_by__first_name",
                    "created_by__last_name",
                    "created_by__username",
                    "created_by__profile__avatar",
                )
                .annotate(pages_created=Count("id"))
                .order_by("-pages_created", "created_by__username")
                .first()
            )
            monthly_contributor = None
            if monthly_contrib_qs:
                first = monthly_contrib_qs.get("created_by__first_name") or ""
                last  = monthly_contrib_qs.get("created_by__last_name")  or ""
                # Costruisce l'URL completo dell'avatar usando MEDIA_URL
                avatar_path = monthly_contrib_qs.get("created_by__profile__avatar")
                avatar_url  = None
                if avatar_path:
                    from django.conf import settings as dj_settings
                    media_url = getattr(dj_settings, "MEDIA_URL", "/media/")
                    avatar_url = request.build_absolute_uri(f"{media_url}{avatar_path}")
                monthly_contributor = {
                    "user_id":      monthly_contrib_qs["created_by__id"],
                    "name":         (f"{first} {last}".strip() or monthly_contrib_qs["created_by__username"]),
                    "username":     monthly_contrib_qs["created_by__username"],
                    "avatar":       avatar_url,
                    "pages_created": monthly_contrib_qs["pages_created"],
                }

            # Top query più usate (use_count)
            top_queries_qs = (
                WikiQuery.objects
                .filter(deleted_at__isnull=True, use_count__gt=0)
                .select_related("language")
                .order_by("-use_count")[:8]
            )
            top_queries_data = [
                {
                    "id":        q.pk,
                    "title":     q.title,
                    "use_count": q.use_count,
                    "language":  q.language.label if q.language else None,
                    "lang_color": q.language.color if q.language else "#64748b",
                    "lang_text_color": q.language.text_color if q.language else "#ffffff",
                }
                for q in top_queries_qs
            ]

            return {
                "totals": {
                    "total": total_pages,
                    "published": int(totals["published"] or 0),
                    "drafts": int(totals["drafts"] or 0),
                    "total_views": int(totals["total_views"] or 0),
                    "rated_pages": rated_pages_count,
                    "unrated_pages": max(total_pages - rated_pages_count, 0),
                    "total_votes": int(rating_totals["total_votes"] or 0),
                    "average_rating": round(float(rating_totals["average_rating"] or 0), 2),
                },
                "by_category": by_category_data,
                "recent": recent_data,
                "top_authors": top_authors_data,
                "top_rated_pages": top_rated_pages_data,
                "low_rated_pages": low_rated_pages_data,
                "unrated_pages": unrated_pages_data,
                "most_viewed_pages": most_viewed_pages_data,
                "rating_distribution": rating_distribution,
                "monthly_contributor": monthly_contributor,
                "top_queries": top_queries_data,
                "total_queries": WikiQuery.objects.filter(deleted_at__isnull=True).count(),
            }
        except Exception as e:
            logger.exception("Wiki stats error")
            payload = {
                "detail": "Errore durante il calcolo delle statistiche Wiki.",
                "code": "wiki_stats_error",
            }
            if settings.DEBUG:
                payload.update({
                    "error_type": e.__class__.__name__,
                    "error": str(e),
                })
            return Response(payload, status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR)




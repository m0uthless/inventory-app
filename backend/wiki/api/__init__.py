"""wiki/api/ — API package per il modulo wiki.

Espone tutte le classi pubbliche necessarie a config/urls.py in un unico
namespace, mantenendo la backward compatibility con l'import originale:

    from wiki.api import WikiCategoryViewSet, WikiPageViewSet, ...
"""
from wiki.api.helpers import (  # noqa: F401
    _sanitize_html,
    _is_html,
    _markdown_to_html,
    _markdown_to_plain_text,
    _attachment_accel_response,
    _label_for_wiki_link,
    _path_for_wiki_link,
    _slug_is_available,
    _suggest_available_slug,
)
from wiki.api.categories import WikiCategorySerializer, WikiCategoryViewSet  # noqa: F401
from wiki.api.pages import WikiPageSerializer, WikiPageViewSet  # noqa: F401
from wiki.api.attachments import WikiAttachmentSerializer, WikiAttachmentViewSet  # noqa: F401
from wiki.api.links import WikiLinkSerializer, WikiLinkViewSet  # noqa: F401
from wiki.api.revisions import WikiPageRevisionSerializer, WikiPageRevisionViewSet  # noqa: F401
from wiki.api.stats import WikiStatsView  # noqa: F401
from wiki.api.queries import (  # noqa: F401
    WikiQueryLanguageSerializer,
    WikiQueryLanguageViewSet,
    WikiQuerySerializer,
    WikiQueryViewSet,
)

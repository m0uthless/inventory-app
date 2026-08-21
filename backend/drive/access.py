from __future__ import annotations

from django.db.models import Q

from .models import DriveFile, DriveFolder

# VER-002 (audit 2026-08-19, confermato con Fede): l'ACL è EREDITARIA — una
# cartella figlia è accessibile solo se l'utente supera il check su ogni
# livello della catena (cartella stessa + tutti gli antenati). Una
# sottocartella senza allowed_groups propri dentro una cartella riservata
# NON è più "aperta di default": eredita la restrizione del genitore.
#
# Limite noto a livello di QUERYSET (liste/filtri): la catena di antenati
# considerata è profonda al massimo 6 livelli (coerente con il
# select_related("parent", "parent__parent", ... x5) già usato altrove in
# drive/api.py per breadcrumb/move). Oltre questa profondità un antenato
# restrittivo non verrebbe visto da filter_accessible_folders/files.
# has_folder_access/has_file_access (usati per l'accesso diretto a un
# singolo oggetto: detail, children, breadcrumb, move, download) NON hanno
# questo limite: risalgono l'intera catena via folder.parent, con lo stesso
# guard anti-ciclo (MAX_DEPTH=50) già in uso in drive/api.py. Quindi un
# oggetto oltre 6 livelli di profondità resta correttamente protetto se
# aperto direttamente, ma potrebbe comparire in una lista/queryset dove non
# dovrebbe. Da approfondire se gli alberi di cartelle di Fede superano
# questa profondità.
_ANCESTOR_PREFIXES = (
    "",
    "parent__",
    "parent__parent__",
    "parent__parent__parent__",
    "parent__parent__parent__parent__",
    "parent__parent__parent__parent__parent__",
)


def _groups_open_or_allowed_q(prefix: str, user_groups):
    field = f"{prefix}allowed_groups"
    return Q(**{f"{field}__isnull": True}) | Q(**{f"{field}__in": user_groups})


def _folder_chain_q(user_groups, prefix: str = ""):
    """AND del check open-or-allowed su questa cartella + fino a 5 antenati."""
    q = Q()
    for suffix in _ANCESTOR_PREFIXES:
        q &= _groups_open_or_allowed_q(f"{prefix}{suffix}", user_groups)
    return q


def filter_accessible_folders(qs, user):
    if getattr(user, "is_superuser", False):
        return qs
    user_groups = user.groups.all()
    return qs.filter(_folder_chain_q(user_groups)).distinct()


def filter_accessible_files(qs, user):
    if getattr(user, "is_superuser", False):
        return qs
    user_groups = user.groups.all()
    own = _groups_open_or_allowed_q("", user_groups)
    folder_chain = _folder_chain_q(user_groups, prefix="folder__")
    return qs.filter(own & (Q(folder__isnull=True) | folder_chain)).distinct()


def has_folder_access(user, folder: DriveFolder) -> bool:
    """Risale l'intera catena di antenati (nessun limite di profondità oltre
    al guard anti-ciclo): la cartella è accessibile solo se l'utente supera
    il check su OGNI livello che ha allowed_groups non vuoto."""
    if getattr(user, "is_superuser", False):
        return True
    user_group_ids = set(user.groups.values_list("id", flat=True))
    node = folder
    depth = 0
    MAX_DEPTH = 50  # stesso guard anti-ciclo usato in drive/api.py (breadcrumb/move)
    while node is not None and depth < MAX_DEPTH:
        allowed_ids = set(node.allowed_groups.values_list("id", flat=True))
        if allowed_ids and not (user_group_ids & allowed_ids):
            return False
        node = node.parent
        depth += 1
    return True


def has_file_access(user, file: DriveFile) -> bool:
    if not getattr(user, "is_superuser", False):
        allowed_ids = set(file.allowed_groups.values_list("id", flat=True))
        if allowed_ids and not (set(user.groups.values_list("id", flat=True)) & allowed_ids):
            return False
    folder = getattr(file, "folder", None)
    return True if folder is None else has_folder_access(user, folder)

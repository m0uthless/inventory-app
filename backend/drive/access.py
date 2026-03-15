from __future__ import annotations

from django.db.models import Q

from .models import DriveFile, DriveFolder


def _groups_open_or_allowed_q(prefix: str, user_groups):
    field = f"{prefix}allowed_groups"
    return Q(**{f"{field}__isnull": True}) | Q(**{f"{field}__in": user_groups})


def filter_accessible_folders(qs, user):
    if getattr(user, "is_superuser", False):
        return qs
    user_groups = user.groups.all()
    return qs.filter(_groups_open_or_allowed_q("", user_groups)).distinct()


def filter_accessible_files(qs, user):
    if getattr(user, "is_superuser", False):
        return qs
    user_groups = user.groups.all()
    return qs.filter(
        _groups_open_or_allowed_q("", user_groups)
        & (Q(folder__isnull=True) | _groups_open_or_allowed_q("folder__", user_groups))
    ).distinct()


def has_folder_access(user, folder: DriveFolder) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    allowed_ids = set(folder.allowed_groups.values_list("id", flat=True))
    if not allowed_ids:
        return True
    return bool(set(user.groups.values_list("id", flat=True)) & allowed_ids)


def has_file_access(user, file: DriveFile) -> bool:
    if not getattr(user, "is_superuser", False):
        allowed_ids = set(file.allowed_groups.values_list("id", flat=True))
        if allowed_ids and not (set(user.groups.values_list("id", flat=True)) & allowed_ids):
            return False
    folder = getattr(file, "folder", None)
    return True if folder is None else has_folder_access(user, folder)

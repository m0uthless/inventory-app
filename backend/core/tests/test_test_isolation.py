"""I test non devono condividere la cache con lo stack dev (stesso Redis)."""
from django.core.cache import cache, caches
from django.core.cache.backends.locmem import LocMemCache


def test_suite_uses_local_cache():
    assert isinstance(caches["default"], LocMemCache)


def test_cache_starts_empty_each_test_part1():
    cache.set("leak-probe", 1)


def test_cache_starts_empty_each_test_part2():
    assert cache.get("leak-probe") is None

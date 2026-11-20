import pytest


@pytest.fixture(autouse=True)
def _local_cache(settings):
    """I test girano accanto allo stack dev, che condivide lo stesso Redis: lo
    stack può riscrivere la cache dei moduli spenti a metà test. Una cache
    locale rende deterministici i test sul modulo spento."""
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

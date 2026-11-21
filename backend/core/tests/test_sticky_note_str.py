import pytest
from django.contrib.auth import get_user_model

from core.models import StickyNote

pytestmark = pytest.mark.django_db


def test_sticky_note_str_does_not_crash():
    u = get_user_model().objects.create_user(username="nota_u", password="pw")
    assert str(StickyNote.objects.create(user=u, text="x")) == "Nota di nota_u"

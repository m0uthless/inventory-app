import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from attendance.models import LeaveArea
from core.models import AreaTask, AreaTaskComment, AreaTaskPriority
from drive.models import DriveFile

pytestmark = pytest.mark.django_db

User = get_user_model()


def _area():
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label="Area Test")


def test_new_fields_have_expected_defaults():
    task = AreaTask.objects.create(area=_area(), title="T")
    assert task.priority == AreaTaskPriority.MEDIUM
    assert task.assigned_to is None
    assert task.drive_files.count() == 0


def test_in_attesa_is_a_valid_status_choice():
    values = [value for value, _label in AreaTask.STATUS_CHOICES]
    assert AreaTask.STATUS_IN_ATTESA == "in_attesa"
    assert values == ["da_fare", "in_corso", "in_attesa", "completato"]


def test_assigned_to_is_nulled_when_user_is_deleted():
    user = User.objects.create_user(username="assignee", password="pw")
    task = AreaTask.objects.create(area=_area(), title="T", assigned_to=user)
    user.delete()
    task.refresh_from_db()
    assert task.assigned_to is None


def test_drive_files_link_and_related_name(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    task = AreaTask.objects.create(area=_area(), title="T")
    f = DriveFile.objects.create(name="a.pdf", file=SimpleUploadedFile("a.pdf", b"x"))
    task.drive_files.add(f)
    assert list(f.area_tasks.all()) == [task]


def test_comments_are_ordered_and_cascade_with_task():
    area = _area()
    author = User.objects.create_user(username="author", password="pw")
    task = AreaTask.objects.create(area=area, title="T")
    AreaTaskComment.objects.create(task=task, author=author, body="primo")
    AreaTaskComment.objects.create(task=task, author=author, body="secondo")
    assert [c.body for c in task.comments.all()] == ["primo", "secondo"]
    task.delete()
    assert AreaTaskComment.objects.count() == 0

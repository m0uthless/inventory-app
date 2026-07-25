"""Test unitari del ponte fascia ↔ orario (soglia 13:00, pausa 13–14)."""
from datetime import time

from attendance.bridge import day_part_covers_now, day_parts_for_hours
from attendance.models import DayPart


def test_hours_before_noon_map_to_morning():
    assert day_parts_for_hours(time(9, 0), time(12, 0)) == [DayPart.MATTINA]


def test_hours_after_lunch_map_to_afternoon():
    assert day_parts_for_hours(time(14, 0), time(16, 0)) == [DayPart.POMERIGGIO]


def test_hours_spanning_lunch_touch_both_fasce():
    assert day_parts_for_hours(time(11, 0), time(17, 0)) == [DayPart.MATTINA, DayPart.POMERIGGIO]


def test_hours_inside_lunch_default_to_morning():
    assert day_parts_for_hours(time(13, 10), time(13, 50)) == [DayPart.MATTINA]


def test_covers_now_split_on_13():
    assert day_part_covers_now(DayPart.MATTINA, time(9, 0)) is True
    assert day_part_covers_now(DayPart.MATTINA, time(15, 0)) is False
    assert day_part_covers_now(DayPart.POMERIGGIO, time(15, 0)) is True
    assert day_part_covers_now(DayPart.POMERIGGIO, time(9, 0)) is False

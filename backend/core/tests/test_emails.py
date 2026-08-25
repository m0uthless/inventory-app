from __future__ import annotations

from core.emails import _brand_for_module


def test_brand_for_module_portal_package_root():
    assert _brand_for_module("portal") == "portal"


def test_brand_for_module_portal_submodule():
    assert _brand_for_module("portal.api") == "portal"
    assert _brand_for_module("portal.signals") == "portal"
    assert _brand_for_module("portal.tests.test_email_brand_detection") == "portal"


def test_brand_for_module_non_portal_defaults_to_archie():
    assert _brand_for_module("core.admin_users_api") == "archie"
    assert _brand_for_module("maintenance.api.plans") == "archie"
    assert _brand_for_module("notifications.management.commands.refresh_notifications") == "archie"


def test_brand_for_module_does_not_match_unrelated_prefix():
    # "portalx" non è il package "portal": non deve fare match per prefisso stringa.
    assert _brand_for_module("portalx.api") == "archie"

from __future__ import annotations


def customer_path(obj_id: int | str) -> str:
    return f"/customers?open={obj_id}"


def site_path(obj_id: int | str) -> str:
    return f"/sites?open={obj_id}"


def contact_path(obj_id: int | str) -> str:
    return f"/contacts?open={obj_id}"


def inventory_path(obj_id: int | str) -> str:
    return f"/inventory?open={obj_id}"


def maintenance_plan_path(obj_id: int | str) -> str:
    return f"/maintenance?tab=plans&open={obj_id}"


def issue_path(obj_id: int | str) -> str:
    return f"/issues?open={obj_id}"


def wiki_page_path(obj_id: int | str) -> str:
    return f"/wiki/{obj_id}"


def drive_root_path() -> str:
    return "/drive"


def drive_folder_path(obj_id: int | str) -> str:
    return f"/drive?folder={obj_id}"


def drive_file_path(obj_id: int | str) -> str:
    return f"/drive?file={obj_id}"


def build_entity_path(app_label: str | None, model: str | None, object_id: int | str | None) -> str | None:
    if not app_label or not model or object_id in (None, ""):
        return None

    app = str(app_label).lower()
    mdl = str(model).lower()

    if app == "crm":
        if mdl == "customer":
            return customer_path(object_id)
        if mdl == "site":
            return site_path(object_id)
        if mdl == "contact":
            return contact_path(object_id)

    if app == "inventory" and mdl == "inventory":
        return inventory_path(object_id)

    if app == "maintenance" and mdl == "maintenanceplan":
        return maintenance_plan_path(object_id)

    if app == "issues" and mdl == "issue":
        return issue_path(object_id)

    if app == "wiki" and mdl == "wikipage":
        return wiki_page_path(object_id)

    if app == "drive":
        if mdl == "drivefolder":
            return drive_folder_path(object_id)
        if mdl == "drivefile":
            return drive_file_path(object_id)

    return None

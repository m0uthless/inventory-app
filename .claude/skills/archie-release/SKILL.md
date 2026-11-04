---
name: archie-release
description: ARCHIE release, changelog and delivery workflow — use when writing CHANGELOG entries, preparing a release (release-save / release-push) or packaging a change.
---

# ARCHIE release & versioning workflow

Keep a Changelog + Semantic Versioning. The release toolchain (`release-save.sh`, `release-push.sh`, `fix-save.sh`, `fix-push.sh`, `prod-sync.sh`, `status.sh`, `archie-dev-common.sh`) lives **outside this repo**, at `/home/fede/scripts` — it is not checked in and Claude Code won't see it by scanning the repo.

- `release-push.sh`'s `normalize_category()` requires **English section headers** (`Added`/`Changed`/`Fixed`/`Security`) — never write Italian headers (Sicurezza/Migliorie/Corretti).
- All new changelog content goes under `## [Unreleased]` — never write a version header directly into the file; the release script promotes `[Unreleased]` to a version on release.
- Flow: implement → run the full verification chain above → package the delivery zip (see below) → `release-save` → follow through `release-push` for the prod push.

### Delivery zip convention

When packaging a change for handoff/testing: name it `archie-xxxxxxx-NN.zip` (`xxxxxxx` = short identifier for the change, `NN` = sequential number — same feature gets `-01`, `-02`, ... for patches; a different feature gets a new identifier). Contains **only** modified/created files. Internal structure mirrors the project starting from the directories inside `inventory-app/`. Exclude `.claude`, `.git`, `__pycache__`, `node_modules`, and any other generated/cache directories.


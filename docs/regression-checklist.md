# Regression checklist

## One-command smoke suite

Quick suite:

```bash
./scripts/smoke.sh quick
```

Full suite:

```bash
./scripts/smoke.sh full
```

Equivalent Make targets:

```bash
make smoke-quick
make smoke
```

## Backend automated checks covered by the smoke suite

The full suite runs these targeted tests:

```bash
cd backend
pytest \
  config/tests/test_auth_session_contracts.py \
  config/tests/test_search_contracts.py \
  wiki/tests/test_render_and_revision_contracts.py \
  core/tests/test_restore_response_contracts.py \
  inventory/tests/test_secrets_contracts.py \
  maintenance/tests/test_plan_list_contract.py \
  audit/tests/test_metadata_masking.py \
  config/tests/test_public_status_contracts.py
```

Recommended focused suites after touching the related areas:

```bash
cd backend
pytest core/tests/test_restore_actions_mixin.py core/tests/test_restore_dependency_policy.py -q
pytest crm/tests/test_contact_integrity.py crm/tests/test_site_contracts.py -q
pytest inventory/tests/test_list_contracts.py inventory/tests/test_secrets_contracts.py -q
pytest maintenance/tests/test_custom_fields_validation.py -q
```

## Frontend automated checks

Unit tests + build locally:

```bash
cd frontend
npm ci
npm run lint
npx tsc --noEmit
npm run test:run
npm run build
```

Equivalent Make target:

```bash
make test-frontend
```

## Manual smoke checks

### Auth
- Open login page.
- Verify invalid credentials show the expected error.
- Verify valid credentials redirect to dashboard.
- Verify logout returns to login and protected routes are blocked.
- Verify login page loads version + public stats without console/API errors.

### Search
- Search for a customer, site, contact, inventory, maintenance plan and wiki page.
- Verify each result opens the expected module or drawer.
- Verify empty search does not show stale results.
- Verify Drive results only appear for users allowed by group ACL.

### Wiki
- Open a page containing formatted content.
- Verify render looks correct in view mode.
- Edit a page, save it, open revisions and restore a previous revision.
- Verify restored content is shown in both drawer/page view.
- Open an attachment preview/download as an authenticated user.

### Trash / Restore
- Soft-delete one customer and one inventory.
- Restore them from Trash and verify list + detail drawer state.
- Try restore on a child item while its parent is still deleted and verify the blocked message.
- Retry bulk restore with mixed valid/invalid ids and verify the response distinguishes restored vs blocked entries.
- Verify both canonical and legacy restore endpoints behave identically where legacy support is still documented.

### Inventory secrets
- Open inventory detail with a user that has `inventory.view_secrets` and verify passwords are visible only there.
- Repeat with a user without `inventory.view_secrets` and verify secrets are hidden.
- Attempt to update a password field without `inventory.view_secrets` and verify the API rejects it.

### CRM integrity
- Create or update a contact with a site from another customer and verify the API rejects it.
- Open site detail and verify `province` and `country` are present in the payload/UI.

### Maintenance + custom fields
- Create or edit a maintenance plan with typed custom fields.
- Verify invalid numeric values return `400`.
- Verify friendly aliases are canonicalized to the stored key.

### Audit
- Trigger an action that writes audit metadata (login failure, update, bulk action).
- Open the audit detail drawer and verify metadata is shown.
- Verify sensitive query params and tokens are masked.

# UI Standards (Progressive Enforcement)

This project follows a small set of UI conventions to keep the UX consistent and accessible.
We enforce these progressively: new code should follow the standards, and existing code is
updated when touched.

## 1) Icon actions

### ✅ Use

- `ActionIconButton` (`frontend/src/ui/ActionIconButton.tsx`)

Why:

- forces an accessible label (`aria-label`)
- always shows a tooltip
- keeps disabled tooltips working

### ❌ Avoid

- `IconButton` directly from `@mui/material`

ESLint warns when importing `IconButton` directly.

## 2) Drawers and detail layouts

Use `DetailDrawerHeader` for drawer headers and keep spacing consistent.
When we introduce a dedicated `AppDrawer` wrapper, new drawers should use it.

## 3) Forms

Prefer consistent spacing and inline error messages (`helperText`).
When we introduce `FormSection`, new forms should use it.

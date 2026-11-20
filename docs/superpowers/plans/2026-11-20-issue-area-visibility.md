# Visibilità delle issue per area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chi non ha `issues.view_all_areas` vede solo le issue della propria area e quelle senza area, ovunque. Chi ha il permesso usa l'interruttore «Tutte le aree» nella pagina Issue. L'area si cambia al volo dai Dettagli della finestra.

**Architecture:** una sola funzione `visible_issues_q(user, prefix="")` in `backend/issues/visibility.py`, applicata a tutte le letture: viewset, riepilogo, annotazioni di crm e inventory, etichetta dei link Wiki. Il frontend aggiunge l'interruttore (parametro `scope=mine`) e una QuickPick «Area».

**Tech Stack:** Django 5 + DRF, pytest; React 19 + TS + MUI, vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-issue-area-assignee-groups-design.md` (Parte 3).

## Global Constraints

- Permesso `issues.view_all_areas` «Vede le issue di tutte le aree», in `Issue.Meta.permissions` accanto a `be_assignee`.
- Regola: superuser o permesso → tutto; area nel profilo → `area = propria` OR `area IS NULL`; nessuna area nel profilo → tutto.
- Una issue non visibile dà 404 su dettaglio e azioni.
- `?scope=mine` sull'elenco restringe a propria area più issue senza area, per chiunque abbia un'area (per chi non ce l'ha non ha effetto).
- Le email automatiche non si filtrano.
- Comandi e baseline: come nei piani del 2026-11-19 (lint 5, vitest 265, pytest 1023).

## Review Focus

1. Un utente senza permesso chiede `/api/issues/<id>/comments/` di una issue fuori area → 404. → test Task 1.
2. Conteggi di cliente e sito per chi non ha il permesso: escludono le issue fuori area. → test Task 1.
3. Superuser senza area nel profilo: vede tutto. → test Task 1.
4. Interruttore attivo per chi ha il permesso: niente `scope`; spento: `scope=mine`; per chi non ha il permesso l'interruttore non si mostra. → test Task 2.
5. QuickPick «Area» con un assegnatario fuori dalla nuova area: la patch toglie l'assegnatario e mostra l'avviso. → test Task 2.

---

### Task 1: Backend — regola di visibilità ovunque

**Files:**
- Modify: `backend/issues/models.py` (permesso), Create: `backend/issues/migrations/0011_*.py`
- Create: `backend/issues/visibility.py`
- Modify: `backend/issues/api.py` (`get_queryset`, `summary`, filtro `scope`), `backend/crm/api.py` (~433, ~462, ~807), `backend/inventory/api.py` (~438, ~457), `backend/wiki/api/helpers.py` (~201)
- Test: Create `backend/issues/tests/test_issue_visibility.py`

**Interfaces:**
- Produces: `visible_issues_q(user, prefix: str = "") -> Q`; `can_see_all_areas(user) -> bool`.

- [ ] Step 1: test che falliscono. `test_list_hides_other_area_issues`, `test_detail_of_other_area_is_404`, `test_comments_of_other_area_is_404`, `test_permission_sees_all_areas`, `test_superuser_sees_all`, `test_user_without_area_sees_all`, `test_scope_mine_restricts_even_with_permission`, `test_summary_counts_only_visible`, `test_customer_and_site_open_issues_count_only_visible`, `test_inventory_active_issue_badge_only_visible`, `test_wiki_link_label_hides_invisible_issue_title`.
- [ ] Step 2: lanciarli e verificare che falliscano.
- [ ] Step 3: aggiungere il permesso e la migrazione, poi `visibility.py`. Applicare la regola: in `get_queryset` con `.filter(visible_issues_q(user))`; in `summary` combinandola con `scope`; nelle annotazioni di crm e inventory aggiungere `visible_issues_q(self.request.user)` alle subquery su Issue (sul join `issues__` della `active_issue_count` usare `prefix="issues__"`). La label Wiki riceve l'utente dalla request del serializer (context): se la issue non è visibile mostra solo `#id`.
- [ ] Step 4: suite completa verde, `check` e `makemigrations --check` puliti.
- [ ] Step 5: commit `feat(issue): visibilità per area con permesso «Vede tutte le aree»`.

### Task 2: Frontend — interruttore e Area nei Dettagli

**Files:**
- Modify: `frontend/src/auth/perms.ts` (`PERMS.issues.issue.viewAllAreas = 'issues.view_all_areas'`), `frontend/src/pages/Issues.tsx` (interruttore nella barra, `scope=mine` in `allExtraParams`, `localStorage` `issues_all_areas`), `frontend/src/features/issues/IssueDetail.tsx` (QuickPick «Area» nei Dettagli; prop `areas: AreaOption[]`)
- Create: helper puro `issueScopeParam(canSeeAll: boolean, allAreas: boolean, myArea: number | null): 'mine' | undefined` in `frontend/src/features/issues/issueUsers.ts` (accanto agli altri helper delle issue)
- Test: `issueUsers.test.ts`, `IssueDetail.test.tsx`

- [ ] Step 1: test che falliscono. `issueScopeParam`: (true, false, 4) → 'mine'; (true, true, 4) → undefined; (false, *, 4) → undefined (restringe già il server); (true, false, null) → undefined. IssueDetail: QuickPick «Area» → scegliendo un'altra area con assegnatario non membro chiama `onPatch({ area: 5, assigned_to: null }, …)` e mostra «L'assegnatario non fa parte della nuova area: è stato tolto.»; con assegnatario membro `onPatch({ area: 5 }, 'Area aggiornata')`; in sola lettura la QuickPick è disabilitata.
- [ ] Step 2: lanciarli e verificare che falliscano.
- [ ] Step 3: implementare. L'interruttore (Switch «Tutte le aree») si mostra solo se `hasPerm(viewAllAreas)` e l'utente ha un'area. `IssuePatch` include `area`.
- [ ] Step 4: catena `tsc -b --force` → build → lint (5) → vitest tutto verde.
- [ ] Step 5: commit `feat(issue): interruttore Tutte le aree e Area nei Dettagli`.

### Task 3: Changelog e dev

- [ ] Step 1: `CHANGELOG.md` `[Unreleased]` → `Added`: visibilità per area con il permesso «Vede le issue di tutte le aree» (migrazione `issues.0011`), interruttore «Tutte le aree», Area nei Dettagli. **Dopo il deploy**: dare il permesso ai gruppi che devono vedere tutto, altrimenti chi ha un'area vede solo la sua.
- [ ] Step 2: rebuild `backend cron frontend`, `migrate`, `/api/health/`.
- [ ] Step 3: commit `docs(changelog): visibilità issue per area`.

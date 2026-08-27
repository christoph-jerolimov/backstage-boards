## 1. Backend

- [x] 1.1 Add `BoardChangeEntry` type, `getBoardChanges` (read access, newest first, limit clamp) with unit tests incl. access rejection, route, and API client method

## 2. Frontend

- [x] 2.1 Extract `changeSummary` helper and reuse in the drawer timeline; build `RecentChangesDialog` and add "Recent changes…" to a now always-visible more menu (admin entries stay admin-only); verify entries open the item drawer

## 3. Verification

- [x] 3.1 tsc, lint, tests green; Playwright smoke: modal lists changes newest first and clicking an entry opens the item

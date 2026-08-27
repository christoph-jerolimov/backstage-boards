## 1. Backend

- [x] 1.1 Migration + archive/restore/purge in `BoardsService` (list exclusion, change records, notifications, external-item rule) with unit tests covering the four spec scenarios
- [x] 1.2 Routes for archived list and restore; scheduler task wiring in the plugin; API client methods

## 2. Frontend

- [x] 2.1 `ArchivedItemsDialog` from the more menu with restore buttons; verify delete → appears archived → restore → reappears with history intact

## 3. Verification

- [x] 3.1 tsc, lint, tests green; Playwright smoke of the archive/restore round-trip

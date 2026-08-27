## 1. Shared + backend

- [x] 1.1 Add `ItemFilter` + `itemMatchesFilter` to boards-common with unit tests (text/tags/labels/combined)
- [x] 1.2 Implement SQL filters in `listItems`, parse query params in the router, add the read-only `list-items` action; unit tests for SQL semantics matching the shared helper and action permission behavior

## 2. Frontend

- [x] 2.1 Filter bar on the board page (search field, tags menu, labels menu, clear) filtering both views via `itemMatchesFilter`; verify with UI smoke on both views

## 3. Verification

- [x] 3.1 tsc, lint, tests green; Playwright smoke of text+tag+label filtering and clearing

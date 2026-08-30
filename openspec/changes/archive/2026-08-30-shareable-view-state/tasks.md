## 1. URL state

- [x] 1.1 Add the search-params adapter mode to `useItemFilter`
      (text, tags, assignees, priorities, overdue), replace-writes,
      clear removing the parameters; verify with filter-bar tests
      driven through a router with initial entries.
- [x] 1.2 Add `useBoardViewParams` for `view`, `group`, and `sort`
      with validation and default omission; verify with BoardPage
      tests for restore and invalid values.

## 2. Wiring

- [x] 2.1 Use both in `BoardPage` (my-items untouched) and verify the
      full frontend suite passes.

## 3. Docs

- [x] 3.1 Update `docs/features/board.md` and README with the
      shareable-URL behavior; verify wording.

## 1. Shared filter

- [x] 1.1 Add `overdue?: boolean` to `ItemFilter`, `isEmptyFilter`, and
      `itemMatchesFilter` (via `dueState`), and verify new
      `filter.test.ts` cases for overdue matching pass.

## 2. Frontend chip

- [x] 2.1 Extend `useItemFilter` with `overdue`, `overdueCount`, and
      `toggleOverdue`, resetting in `clear()`; verify via hook-driven
      component tests.
- [x] 2.2 Render the "Overdue (n)" toggle chip in `ItemFilterBar`
      (hidden with no overdue items and toggle off, ✓ prefix while
      active); verify with new ItemFilterBar tests covering toggle,
      count, hiding, and clear.

## 3. API parity

- [x] 3.1 Accept `overdue=true` on `GET /boards/:boardId/items` and
      filter `due_date < today` in `BoardsService.listItems`; verify
      with a router or service test.

## 4. Docs

- [x] 4.1 Update README filter-bar bullet and
      `docs/features/items.md` to mention the overdue quick filter and
      verify wording matches behavior.

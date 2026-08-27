# Tasks

## 1. Common + backend

- [x] 1.1 `dates.ts` helpers in boards-common (validation, today/
      tomorrow/Friday, due-state) with unit tests; `BoardItem.dueDate`
- [x] 1.2 Migration `items.due_date`; `updateItem` dueDate support with
      validation + change tracking; router and `update-item` action
      pass-through; service tests

## 2. Frontend

- [x] 2.1 `DueDateBadge` with warning/error colors; show on kanban cards
      and as sortable table column
- [x] 2.2 Card quick due-date menu (Today / Tomorrow / This week (Fri) /
      Remove) for writers
- [x] 2.3 Drawer due-date field allowing any date or clearing it

## 3. Verification

- [x] 3.1 `yarn tsc`, unit tests, lint, Playwright smoke (colors, quick
      menu, drawer field)

# Tasks

## 1. Common

- [ ] 1.1 `ChecklistEntry` type plus `checklist` on `BoardItem`,
      `NewItem`, and `ItemUpdate` in boards-common
- [ ] 1.2 `checklist.ts` helpers (`normalizeChecklist`,
      `isValidChecklist`, `checklistProgress`, limits) exported from the
      barrel, with unit tests

## 2. Backend

- [ ] 2.1 Migration `20260827_09_item_checklists` creating
      `item_checklist_items`; extend the migrations test
- [ ] 2.2 Hydrate checklists in `hydrateItems` (ordered by position) and
      write them in `writeAssociations`; carry them in `copyItemsInto`
- [ ] 2.3 `updateItem` validation, change tracking (`field:
      'checklist'`), and router pass-through on PATCH and POST; service
      tests for set / tick / clear / rejection / duplication
- [ ] 2.4 `set-item-checklist` action and `checklist` in the
      `list-items` output projection

## 3. Frontend

- [ ] 3.1 `ChecklistBadge` with complete/partial styling and unit tests;
      show it on kanban cards, in the table view, and on my-items
- [ ] 3.2 `ChecklistField` in the item drawer: tick, edit, remove, and
      append entries; read-only for readers and externally managed items
- [ ] 3.3 Readable `changeSummary` for checklist history entries

## 4. Verification

- [ ] 4.1 `yarn tsc`, unit tests, lint, and a Playwright smoke covering
      add two entries → tick one → card shows `1/2`

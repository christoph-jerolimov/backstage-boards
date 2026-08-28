# Tasks: Add Item Checklist

## 1. Shared types and database

- [ ] 1.1 Add `ChecklistEntry { text: string; checked: boolean }` to `plugins/boards-common/src/types.ts`, add optional `checklist` to `BoardItem`, `NewItem`, and `ItemUpdate`, and export it from `src/index.ts`; verify `yarn tsc` (workspace typecheck) passes.
- [ ] 1.2 Append migration `20260828_02_item_checklists` in `plugins/boards-backend/src/database/migrations.ts` creating `item_checklist_entries` (`item_id` FK → `items.id` ON DELETE CASCADE, `position`, `text`, `checked`, PK `(item_id, position)`) with a `down` that drops it, and register `ChecklistEntryRow` in `tables.ts`; verify by extending `database/migrations.test.ts` to run up/down over the new migration.

## 2. Backend service and router

- [ ] 2.1 In `BoardsService.ts`: hydrate `checklist` (ordered by `position`) in `hydrateItems`, write it on `createItem`, and in `updateItem` validate entries (trim text, reject empty/whitespace-only with the standard input error), delete-then-insert `item_checklist_entries` in the item transaction, and record a `checklist` change record; verify with new `BoardsService.test.ts` cases: round-trip order + done states, empty-label rejection leaves item unchanged, history entry recorded, external-manager and read-only rejection paths.
- [ ] 2.2 Copy `item_checklist_entries` rows in `copyItemsInto` for board duplication; verify with a `BoardsService.test.ts` duplication case asserting entries, order, and done states on the copied item.
- [ ] 2.3 Accept `checklist` in the body allowlists of `POST /boards/:boardId/items` and `PATCH /boards/:boardId/items/:itemId` in `router.ts`; verify with `router.test.ts` cases that the field persists via the endpoints and that an invalid entry returns a 400.

## 3. Frontend editing

- [ ] 3.1 Create `plugins/boards/src/components/ChecklistEditor.tsx` (modeled on `TagsEditor.tsx`): ordered entries with checkboxes and labels, inline add input (ignores empty submissions), per-entry label edit and remove, `readonly` mode with disabled controls and no add/remove; verify with a `ChecklistEditor.test.tsx` covering add, toggle, edit, remove, empty-add ignored, and readonly.
- [ ] 3.2 Wire `ChecklistEditor` into `ItemDrawer.tsx` as a `DrawerField label="Checklist"` calling `patchItem({ checklist })`, passing the drawer's existing `readonly` derivation; update `testItem` in `__testUtils__/testHelpers.tsx` with a `checklist` field; verify with `ItemDrawer.test.tsx` cases for editing and for the read-only/externally-managed drawer.

## 4. Card progress badge

- [ ] 4.1 In `BoardView.tsx`'s `ItemCard`, render a `done/total` chip (e.g. `1/3`) next to the priority/due-date badges when the item has at least one checklist entry, with complete styling when `done === total` and nothing rendered for empty checklists; verify with `BoardView.test.tsx` cases for `1/3`, `3/3` (complete styling), and no badge without a checklist.

## 5. Integration verification

- [ ] 5.1 Run the full verification suite — `yarn tsc`, `yarn lint`, and Jest for `plugins/boards-common`, `plugins/boards-backend`, and `plugins/boards` — and confirm all pass.
- [ ] 5.2 Manually exercise the flow against the running app (`yarn start`): add a checklist in the drawer, toggle an entry, confirm the card badge shows `1/3` and updates live, and confirm a read-only viewer sees but cannot edit; note the outcome in the change.

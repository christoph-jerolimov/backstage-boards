# Add Item Checklist

## Why

Board items often represent work that breaks down into a handful of small steps (e.g. "write docs", "update tests", "announce"). Today users cram these into the markdown description where they are invisible from the board. An optional, lightweight checklist per item — simple strings with a checkbox — lets users track sub-steps directly, and surfacing a "1/3 done" progress indicator on the card makes progress visible at a glance without opening the item.

## What Changes

- Board items gain an optional **checklist**: an ordered list of entries, each a plain text string plus a done/undone checkbox.
- The item drawer gets a **Checklist** section where users with write access can add entries, edit their text, toggle them done, and remove them. Read-only viewers (and externally managed items) see the checklist without editing.
- Cards in the board view show a **progress badge** (e.g. `1/3`) when the item has a checklist; items without a checklist are unchanged.
- The backend persists checklist entries in a new child table, returns them on `BoardItem`, accepts them on item create/update (wholesale replace, like tags), records checklist edits in the item change history, and copies checklists when a board is duplicated.

Non-goals: no drag-and-drop reordering of entries, no due dates/assignees on entries, no conversion of entries to items, no change to the agent actions surface.

## Capabilities

### New Capabilities

- `boards/item-checklists`: Optional per-item checklist of plain-text entries with done state — editing in the item drawer, progress display on board cards, persistence, history, and duplication behavior. Follows the same organization as `boards/item-priorities` (a self-contained optional item attribute).

### Modified Capabilities

<!-- none — the checklist is additive and self-contained; no existing requirement changes -->

## Impact

- `plugins/boards-common/src/types.ts`: new `ChecklistEntry` type; `BoardItem`, `NewItem`, `ItemUpdate` gain an optional `checklist` field.
- `plugins/boards-backend`:
  - `src/database/migrations.ts` + `src/database/tables.ts`: new `item_checklist_entries` table (item id, position, text, checked).
  - `src/service/BoardsService.ts`: hydrate checklist onto items, write on create/update, record change history, copy on board duplication.
  - `src/router.ts`: accept `checklist` on `POST` and `PATCH` item endpoints.
- `plugins/boards`:
  - `src/api.ts`: no new methods — `checklist` rides on `ItemUpdate`.
  - `src/components/ItemDrawer.tsx` + new `ChecklistEditor` component: checklist editing in the drawer.
  - `src/components/BoardView.tsx`: progress badge on cards.
  - Test fixtures in `src/components/__testUtils__/testHelpers.tsx`.
- No new dependencies; no breaking API changes (all fields optional).

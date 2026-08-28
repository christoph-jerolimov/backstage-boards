# Item Checklists

## Why

Items are a single unit of work with no way to express the steps inside
them. Teams either split one task into several cards — losing the fact
that they belong together — or track the steps in the description, where
nothing is countable and progress is invisible from the board. A small
checklist on an item, with its progress shown on the card, makes partly
done work legible at a glance.

## What Changes

- Items get an optional checklist: an ordered list of entries, each a
  short text with a done flag. It is stored in the database, exposed
  through the REST API and the item actions, and checklist changes are
  recorded in the item change history.
- Kanban cards, the table view, and the my-items table show a progress
  badge (`1/3`) whenever an item has a checklist; items without one show
  nothing. A fully checked list is styled as complete.
- The item details drawer gets a checklist editor: tick and untick
  entries, edit their text, remove them, and add new ones at the end.
- Externally managed items show their checklist read-only, like every
  other field.

## Impact

- `boards-common`: `ChecklistEntry` type, `BoardItem.checklist`,
  `NewItem`/`ItemUpdate` support, and checklist helpers (normalization,
  progress).
- `boards-backend`: migration adding `item_checklist_items`, hydration,
  create/update/duplicate support with change tracking, router
  pass-through, and a `set-item-checklist` action.
- `boards`: `ChecklistBadge` on cards, the table, and my-items; a
  checklist editor in the item drawer; a readable history summary for
  checklist changes.

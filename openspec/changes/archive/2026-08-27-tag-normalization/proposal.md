# Tag Normalization

## Why

Users habitually type tags with a leading `#` (e.g. `#bug`). Those get
stored verbatim, and since the UI historically prefixed tags with `#`
they rendered as `##bug` — and `bug` and `#bug` were two different tags.

## What Changes

- Tags are normalized on save: every `#` character is stripped,
  whitespace trimmed, empty results dropped, duplicates removed. Applies
  to item creation and updates through every entry point (UI, REST,
  actions).
- The UI no longer displays tags with a `#` prefix (cards, table already
  plain, drawer, My items, filters).

## Impact

- `boards-common`: `normalizeTags` helper.
- `boards-backend`: normalization in `writeAssociations` and the
  `updateItem` diff.
- `plugins/boards`: display without `#` in KanbanView, ItemDrawer,
  MyItemsPage.

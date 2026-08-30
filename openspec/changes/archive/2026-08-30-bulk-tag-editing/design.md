## Context

`BulkActionsBar` already renders Status/Priority/Assignee/Due date menus
driven by two shared helpers: `stateOf` for the ✓/– match markers and the
`bulk` fan-out (`BulkActions.updateItems`) which runs per-item
`updateItem` calls in parallel and surfaces partial failures. The
`updateItem` API and `ItemUpdate` type already accept `tags`, and
`normalizeTags` from `@internal/plugin-boards-common` is the shared tag
normalizer. `BoardPage` computes `filter.allTags` (all tags on the
board's items) for the drawer's `TagsEditor` suggestions.

## Goals / Non-Goals

**Goals:**
- A Tags menu in the bulk bar with the same look, markers, and toggle
  semantics as the assignee menu.
- Adding a brand-new tag to the whole selection without leaving the bar.
- Clearing tags in bulk.

**Non-Goals:**
- No backend changes; the item update API already carries tags.
- No changes to the drawer's `TagsEditor`.
- No per-item tag editing from the table cells.

## Decisions

- **Toggle semantics mirror bulk assignees**: choosing a tag adds it to
  the items missing it; once all selected items have it, choosing it
  removes it everywhere. This is already the established mental model in
  the bar and needs no new UI affordances.
- **Tag pool = tags on the board's items** (`filter.allTags` computed in
  `BoardPage`, passed as a `tagPool` prop), matching the suggestions the
  drawer offers. Sorted alphabetically.
- **"Add tag…" opens a small inline popover with a text input** rather
  than embedding `TagsEditor`: `TagsEditor` renders a tag list + removal
  chips, which doesn't fit a menu. A `MenuItem` that opens a
  minimal input (Dialog-free, using the same `SearchAutocomplete`-style
  plain input) keeps the bar compact. The typed value goes through
  `normalizeTags` before applying, so `Q3 Carryover` becomes the same
  normalized form the drawer would store.
- **"Remove all tags"** maps to `updateItems` with `{ tags: [] }` for
  every selected item that has tags, mirroring "No assignee".

## Risks / Trade-offs

- The menu can get long on boards with many tags; alphabetical order and
  the menu's own scrolling keep it usable. No search/filter inside the
  menu for now.
- Concurrent edits: the update sends the full computed tags array per
  item (read-modify-write), same as the assignee toggle does today; last
  writer wins, which is the board's existing behavior.

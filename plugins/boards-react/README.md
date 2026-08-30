# @internal/plugin-boards-react

Reusable React building blocks for the boards plugin family, built on
[`@backstage/ui`](https://backstage.io/docs/frontend-system/building-plugins/ui)
and usable from any frontend plugin.

None of these components know about boards, items, or the boards API —
their only domain dependency is `@internal/plugin-boards-common` for
small value types and helpers (`text:` identities, column colors,
checklist entries, due-date math).

## What's inside

- **`CatalogRefPicker`** — catalog-backed autocomplete over entity refs,
  with kind filtering, exclusions, an option cap, and optional free-text
  `text:` identities. `EntityPicker` (all kinds) and `PrincipalPicker`
  (users/groups) are thin presets over it.
- **`TablePagination`** — the footer under a paged table: range summary,
  previous/next, page size.
- **`EditableMarkdown`** — markdown display/edit block with retained
  version history and draft persistence.
- **`MarkdownContent`** / **`parseMarkdown`** — safe renderer and
  tokenizer for a markdown subset with catalog entity auto-linking; raw
  HTML is never emitted.
- **`TagsEditor`** — tag list with per-tag removal and an inline
  autocomplete adder.
- **`ChecklistEditor`** / **`ChecklistBadge`** — checkbox rows with
  click-to-edit labels, and the compact `1/3` progress label.
- **`StatusChip`**, **`ColorDot`**, **`StatusBadge`**, **`PriorityChip`**
  — colored status/priority pills and dots.
- **`DueDateBadge`** — compact due-date label, warning/error colored as
  the date approaches and passes.
- **`InlineEdit`**, **`InlineAddField`** — click-to-edit text and a
  field revealed in place of an "add" button.
- **`AsyncList`**, **`ErrorText`** — the loading → error → empty →
  content sequence, and the one error style.
- **`RefDisplay`**, **`RefLabel`**, **`EntityRefList`** — entity-ref
  labels that link catalog refs and render `text:` identities plainly.
- **`useAsyncAction`** — pending/error state around a mutation, so
  dialogs and menus don't hand-roll the same try/catch.
- **`selectedOption`**, **`formatDate`** — small helpers.

Components that fetch (only `CatalogRefPicker` and the version history in
`EditableMarkdown`) use `@tanstack/react-query` and expect a
`QueryClientProvider` in the tree, which the boards pages already
provide.

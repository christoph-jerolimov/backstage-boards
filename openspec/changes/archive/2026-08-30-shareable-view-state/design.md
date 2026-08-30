## Context

`useItemFilter` (ItemFilterBar.tsx) keeps text/tags/assignees/
priorities/overdue in `useState`; `BoardPage` keeps `view`, `groupBy`,
and (since the drawer navigation) `tableSort` in `useState`. The page
already uses `useSearchParams` for the open item (`item` parameter),
so the URL is established as page state. The my-items page reuses
`useItemFilter`.

## Goals / Non-Goals

**Goals:**
- Round-trip the whole board view state through the URL with clean
  defaults.

**Non-Goals:**
- No saved/named filter presets, no per-user persistence.
- No my-items URL state (its filter stays session-local).
- The `item` parameter (open drawer) already exists and is untouched.

## Decisions

- **One URL-state hook** (`useBoardViewParams`) in the board page
  module owning view/group/sort, plus an opt-in `params` mode for
  `useItemFilter`: the hook takes an optional adapter `{ get, set }`
  backed by `useSearchParams`; without it the existing `useState`
  behavior remains (my-items unchanged).
- **Replace, not push**: all writes use
  `setSearchParams(next, { replace: true })` so typing does not spam
  history.
- **Parameter names**: `q`, `tag`, `assignee`, `priority`,
  `overdue=1`, `group`, `view`, `sort` (`-` prefix = descending, e.g.
  `sort=-dueDate`). Values validated against the known enums; invalid
  values fall back to defaults.
- Sort column ids come from the table's sortable column ids; the
  encoded field is the column key.

## Risks / Trade-offs

- URL length with many tags/assignees; acceptable, repeated params are
  standard.
- The `overdue` chip's count still hides the chip when 0 — an URL with
  `overdue=1` on a board without overdue items still applies the
  filter and keeps the (checked) chip visible, matching the existing
  "kept while active" behavior.

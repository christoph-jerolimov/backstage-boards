# Design

## Context

See proposal. `TableView` uses the react-aria-based `TableRoot`, which natively supports `sortDescriptor`/`onSortChange` and `allowsSorting` columns.

## Goals / Non-Goals

**Goals:** header-driven client-side sorting for the four scannable columns.
**Non-Goals:** server-side sorting; sorting the kanban view (its order is the manual position).

## Decisions

- Pure `sortItems(items, descriptor, columns)` in `grouping.ts` (tested): title/createdBy `localeCompare` case-insensitive, status by column title, updated by ISO timestamp; direction from the descriptor; no descriptor → board order.
- `TableView` keeps one `sortDescriptor` state at the top level (shared by all group tables), passes `allowsSorting` on the four columns, and sorts after grouping.

## Risks / Trade-offs

- [None significant] → additive, view-local behavior.

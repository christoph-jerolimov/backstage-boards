# Design

## Context

See proposal. Items and their tags/labels are normalized rows, so backend filtering is plain SQL; the frontend already holds the full item list per board, so UI filtering is a pure function over loaded items.

## Goals / Non-Goals

**Goals:** shared filter semantics (AND across filters, AND within tags/labels), one pure `matchesFilter` util used by the UI, SQL-backed filters for API/actions.
**Non-Goals:** server-driven UI filtering (client-side is fine at current scale), fuzzy search, assignee/status filters (status is the column lanes already).

## Decisions

- `ItemFilter` in boards-common: `{ text?, tags?: string[], labels?: Record<string, string> }` plus a pure `itemMatchesFilter(item, filter)` helper — used by the frontend and unit-tested once; the backend implements the same semantics in SQL (text: LIKE on title/description lowercased; tags: one EXISTS per tag; labels: one EXISTS per pair).
- Router parses `?text=`, repeatable `?tag=`, repeatable `?label=key=value` (first `=` splits).
- Frontend: filter state in `BoardPage`; `SearchField` for text, a "Tags" menu with checkbox-style multi-select built from the tags present, a "Labels" menu from the label pairs present. Active filters shown with a clear button.
- `list-items` action output keeps items compact: `{ id, title, columnId, tags, labels, assignees }`.

## Risks / Trade-offs

- [Duplicate filter logic (SQL + TS)] → both covered by tests with the same scenarios; semantics documented on `ItemFilter`.

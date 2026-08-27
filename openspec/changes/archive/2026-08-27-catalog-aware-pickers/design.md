# Design

## Context

See proposal. `ShareDialog` uses a raw `TextField`; `ItemDrawer` edits assignees as a comma-separated string. BUI `Combobox` (options variant) supports controlled search input plus `selectedKey`/`onSelectionChange`. The catalog API is available via `catalogApiRef` from `@backstage/plugin-catalog-react` (already a dependency).

## Goals / Non-Goals

**Goals:** shared picker component, chip-based assignee editing, catalog-only share principals.
**Non-Goals:** server-side search paging (entities loaded once with `getEntities` filter kind User/Group, capped); creator editing.

## Decisions

- `PrincipalPicker` props: `{ label?, ariaLabel, placeholder?, allowText, exclude?: string[], onSelect(ref) }`. Loads User+Group entities once via `catalogApi.getEntities({ filter: { kind: ['User', 'Group'] } })`, maps to options `{ value: stringifyEntityRef(e), label: title ?? name (kind) }`.
- Controlled search input; options = catalog matches minus `exclude`, plus (when `allowText` and input non-empty) a synthetic `text:<input>` option labeled `Use text "<input>"`. On selection the picker calls `onSelect` and clears itself — add-one-at-a-time model.
- Assignees UI: chips (existing `RefChips` layout, extended with remove buttons) + picker below when editable.

## Risks / Trade-offs

- [Large catalogs make a one-shot load slow] → acceptable for v1; picker is isolated so switching to `queryEntities` server search later is local.

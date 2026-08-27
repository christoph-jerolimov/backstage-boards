# Catalog-Aware Pickers

## Why

Assignees and share principals are entered as raw entity-ref strings today, which is error-prone and unfriendly. Autocomplete backed by the catalog makes picking users and groups fast and validates that they exist.

## What Changes

- New shared `PrincipalPicker` component: a Backstage UI `Combobox` listing catalog `User` and `Group` entities (searchable), optionally offering a `text:<input>` entry for free-text identities.
- Item drawer: the comma-separated assignees text field becomes chips with per-chip remove plus a `PrincipalPicker` to add assignees (catalog refs or `text:`).
- Share dialog: the principal text field becomes a `PrincipalPicker` limited to users and groups (no `text:`).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-management`: assignees are selected via catalog-backed autocomplete with a free-text `text:` fallback.
- `boards/board-sharing`: share principals are selected via catalog-backed autocomplete of users and groups.

## Impact

- `plugins/boards`: new `PrincipalPicker.tsx`, changes in `ItemDrawer.tsx` and `ShareDialog.tsx`; uses `catalogApiRef` from `@backstage/plugin-catalog-react`.
- No backend or schema changes.

# Dark Theme Color Fix

## Why

Kanban lanes, cards, and the item drawer reference Backstage UI CSS variables that do not exist (`--bui-bg-surface-*`, `--bui-border`), so their hardcoded light fallbacks always apply — in dark theme this renders light backgrounds with light text (white on white).

## What Changes

- All inline styles switch to the real Backstage UI theme tokens (`--bui-bg-neutral-*`, `--bui-border-1`, `--bui-fg-link`) without light-only fallbacks, so lanes, cards, borders, the drawer, and chips follow the active theme.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — bug fix in presentation, no spec-level behavior changes (skip_specs) -->

## Impact

- `plugins/boards`: `KanbanView.tsx`, `ItemDrawer.tsx`, `EditableMarkdown.tsx`, `BoardListPage.tsx` style values only.

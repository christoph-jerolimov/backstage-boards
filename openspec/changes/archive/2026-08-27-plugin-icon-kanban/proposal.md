# Plugin Icon: Remix Kanban View

## Why

The boards plugin uses a hand-drawn inline SVG as its page/sidebar icon; the Remix Icons `kanban-view` glyph matches the plugin's purpose and the icon set already used elsewhere.

## What Changes

- The page (and thus sidebar nav) icon becomes `RiKanbanView` from `@remixicon/react`, replacing the custom SVG in `plugin.tsx`.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — cosmetic change, no spec-level behavior changes (skip_specs) -->

## Impact

- `plugins/boards/src/plugin.tsx` only.

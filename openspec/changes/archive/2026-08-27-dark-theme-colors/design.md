# Design

## Context

`@backstage/ui`'s stylesheet defines `--bui-bg-app`, `--bui-bg-neutral-1..4` (+ hover/pressed), `--bui-border-1/2`, and `--bui-fg-*`, all theme-aware. The plugin's inline styles guessed different names with light fallbacks.

## Goals / Non-Goals

**Goals:** theme-correct surfaces in both themes. **Non-Goals:** restyling.

## Decisions

- Lanes: `--bui-bg-neutral-2` (hover/drop target `--bui-bg-neutral-3`); cards and the drawer panel: `--bui-bg-neutral-1`; borders: `--bui-border-1`; drop indicator: `--bui-fg-link`. No hex fallbacks — the app always loads the BUI stylesheet.

## Risks / Trade-offs

- [None] → token rename only.

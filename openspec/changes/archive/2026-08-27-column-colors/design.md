# Design

## Context

See proposal. Column CRUD flows exist end-to-end; migrations run from the in-code list.

## Goals / Non-Goals

**Goals:** palette-based column color visible in header dot, table badge, drawer badge.
**Non-Goals:** arbitrary hex input; per-item colors; theming the whole lane background.

## Decisions

- Palette in boards-common: named entries (`gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, `teal`) with hex values (`COLUMN_COLORS`); DB stores the name, renderers resolve to hex with gray fallback. Invalid names are rejected server-side.
- Migration adds nullable `board_columns.color`; `addColumn`/`updateColumn` accept `color` (null clears).
- Frontend `StatusBadge` component (dot + column title, tinted background) used by `TableView` and the drawer next to the status select; the kanban header renders just the dot before the title. Color picking is a "Color" submenu in the existing column menu.

## Risks / Trade-offs

- [Named palette limits choice] → deliberate for visual consistency; extensible later.

# Design

## Context

`PageBlueprint` takes `icon?: IconElement`; the sidebar nav item derives from the page. `@remixicon/react` is already a dependency.

## Goals / Non-Goals

**Goals:** swap the icon. **Non-Goals:** anything else.

## Decisions

- Replace the local `BoardsIcon` SVG with `<RiKanbanView size={20} />` in the page params; drop the now-unused component.

## Risks / Trade-offs

- [None] → cosmetic.

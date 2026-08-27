# Design

## Context

The toggle is a BUI `ToggleButtonGroup` with two `ToggleButton`s labeled "Board"/"Table".

## Goals / Non-Goals

**Goals:** icon-only toggle with preserved accessibility. **Non-Goals:** other toolbar changes.

## Decisions

- Each `ToggleButton` renders the Remix icon (`size={16}`) with an `aria-label` ("Board view" / "Table view") so tests and assistive tech keep stable names.

## Risks / Trade-offs

- [Icon-only affordance] → aria-labels plus the active-state highlight retain clarity.

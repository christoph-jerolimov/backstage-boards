# Design

## Context

BUI `MenuItem` supports `iconStart?: ReactNode` and `color?: 'primary' | 'danger'`.

## Goals / Non-Goals

**Goals:** leading icons per entry; delete styled as danger. **Non-Goals:** menu restructuring.

## Decisions

- Pass `iconStart={<RiXxx size={16} />}` per entry; the delete entry also gets `color="danger"`.

## Risks / Trade-offs

- [None] → cosmetic.

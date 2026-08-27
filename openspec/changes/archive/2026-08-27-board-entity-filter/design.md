# Design

## Context

See proposal. `listBoards` loads all board rows and filters per-row through the access resolver; the entity tab then filters client-side.

## Goals / Non-Goals

**Goals:** SQL-level `entity_ref` filter reused by the entity tab.
**Non-Goals:** general listing pagination; pushing the access filter itself into SQL (unchanged).

## Decisions

- `listBoards(principal, { favoritesOnly?, entityRef? })` adds `where('entity_ref', entityRef)` to the base query; access filtering continues per row afterwards.
- Router passes `req.query.entityRef` through; client appends the query param; new hook key `['boards', 'byEntity', entityRef]`.

## Risks / Trade-offs

- [None significant] → additive filter on an existing query.

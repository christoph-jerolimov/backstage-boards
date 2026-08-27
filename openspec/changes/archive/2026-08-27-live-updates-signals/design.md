# Design

## Context

See proposal. `@backstage/plugin-signals-backend` and the signals frontend plugin are already installed and active (feature discovery). `BoardsService` is the single mutation funnel, so emitting there covers REST, actions, and future modules alike.

## Goals / Non-Goals

**Goals:** push-based refresh of open board views and the board list.
**Non-Goals:** granular per-entity cache updates (comes with the TanStack Query change), presence, conflict handling.

## Decisions

- Channel `boards`, broadcast recipients, message `{ boardId, itemId? }`. Broadcast is acceptable because the payload is ids only; fetching stays permission-checked. Per-user targeting would require knowing viewers, which signals doesn't track.
- Emission from `BoardsService` after successful mutations (item create/update/move/delete, comment add/edit/delete, column add/update/delete, board update/delete), best-effort with logged failures — mirrors the notification pattern.
- Frontend: `useSignal<{ boardId }>('boards')` in `BoardPage` (refresh when `boardId` matches) and `BoardListPage` (refresh always). Refreshes reuse the existing refresh functions, so no flicker beyond data swap.

## Risks / Trade-offs

- [Broadcast reveals that some board id changed] → ids are opaque UUIDs and all reads are authorized; documented choice.
- [Signal loops: own mutations trigger an extra refresh] → harmless double fetch; deduplication arrives with TanStack Query.

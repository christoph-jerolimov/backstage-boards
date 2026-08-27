# TanStack Query and Optimistic UI

## Why

Every mutation currently refetches the whole board and item list, and moves only render after the server round-trip — sluggish on larger boards. Adopting TanStack Query gives cached, targeted refetches and optimistic updates for the interactions where latency is most visible.

## What Changes

- The boards frontend adopts `@tanstack/react-query` for its primary data (board list, board, items) with a plugin-scoped `QueryClient`.
- Mutations invalidate only the affected query keys; signals-driven refresh becomes targeted invalidation.
- Item move and item title rename apply optimistically: the UI updates immediately from cache, rolls back on error, and reconciles with the server response.
- No behavioral API changes; purely a frontend data-layer change.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-management`: moving an item reflects immediately in the UI (optimistic), reverting if the server rejects the move.

## Impact

- `plugins/boards`: new dependency `@tanstack/react-query`, new `queries.ts` hooks module, refactors in `BoardsPage` (provider), `BoardPage`, `BoardListPage`, `EntityBoardsContent`.

# Design

## Context

See proposal. Data currently loads through a bespoke `useAsyncData` hook with whole-page `refreshAll` after every mutation; signals also trigger full refreshes.

## Goals / Non-Goals

**Goals:** react-query for list/board/items, targeted invalidation, optimistic move + rename.
**Non-Goals:** migrating dialog-local loads (watchers, versions, feeds — they stay on `useAsyncData`), offline support, optimistic column operations.

## Decisions

- One module-level `QueryClient` (staleTime 15s, no refetchOnWindowFocus) provided by `BoardsPage` and `EntityBoardsContent` via `QueryClientProvider` — plugin-scoped, no app-level setup.
- `queries.ts`: `useBoardsQuery`, `useBoardQuery(boardId)`, `useItemsQuery(boardId)` (keys `['boards']`, `['boards', id]`, `['items', id]`) plus `invalidateBoard(queryClient, boardId)` helpers.
- `useMoveItem` mutation: `onMutate` cancels the items query, snapshots, rewrites the moved item's `columnId`/`position` in cache; `onError` restores the snapshot and surfaces the message; `onSettled` invalidates `['items', boardId]`. `useRenameItem` mirrors it for the title.
- Other mutations keep the existing `guarded` flow but end in targeted invalidation instead of manual refetch; the signal handler invalidates instead of refetching directly.

## Risks / Trade-offs

- [Two data patterns coexist (react-query + useAsyncData)] → boundaries are clear: shared page data vs. dialog-local data; full migration can follow later.
- [Optimistic state can flicker when the server assigns a different position] → `onSettled` reconciliation makes it converge within one refetch.

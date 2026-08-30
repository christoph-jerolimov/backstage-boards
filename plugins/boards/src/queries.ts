import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { useSignal } from '@backstage/plugin-signals-react';
import {
  BoardItem,
  BoardWithContext,
  errorMessage,
} from '@internal/plugin-boards-common';
import { BoardListQuery, boardsApiRef } from './api';

/**
 * Plugin-scoped query client. Provided by the boards pages themselves so
 * the app needs no extra setup.
 */
export const boardsQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  boards: ['boards'] as const,
  /** One page of the board list, keyed by its filters and paging. */
  boardsPage: ['boards', 'page'] as const,
  filterOptions: ['boards', 'filter-options'] as const,
  board: (boardId: string) => ['boards', boardId] as const,
  items: (boardId: string) => ['items', boardId] as const,
  myItems: ['boards', 'my-items'] as const,
  permissions: (boardId: string) => ['boards', boardId, 'permissions'] as const,
  archivedItems: (boardId: string) =>
    ['boards', boardId, 'archived-items'] as const,
  changes: (boardId: string) => ['boards', boardId, 'changes'] as const,
  boardWatchers: (boardId: string) => ['boards', boardId, 'watchers'] as const,
  itemWatchers: (boardId: string, itemId: string) =>
    ['boards', boardId, 'items', itemId, 'watchers'] as const,
  timeline: (boardId: string, itemId: string) =>
    ['boards', boardId, 'items', itemId, 'timeline'] as const,
  boardDescriptionVersions: (boardId: string) =>
    ['boards', boardId, 'description-versions'] as const,
  descriptionVersions: (boardId: string, itemId: string) =>
    ['boards', boardId, 'items', itemId, 'description-versions'] as const,
  commentVersions: (boardId: string, itemId: string, commentId: string) =>
    ['boards', boardId, 'items', itemId, 'comments', commentId] as const,
  /** Catalog lookups, which belong to no single board. */
  catalogEntities: (kinds?: string[]) =>
    ['boards', 'catalog-entities', kinds?.join(',') ?? 'all'] as const,
  identity: ['boards', 'identity'] as const,
};

/**
 * One page of the board list. Keyed by the whole request so each
 * filter/page combination caches on its own, and the previous page stays
 * on screen while the next one loads instead of the table flashing empty.
 */
export function useBoardsPageQuery(query: BoardListQuery) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: [...queryKeys.boardsPage, query] as const,
    queryFn: () => boardsApi.listBoards(query),
    placeholderData: keepPreviousData,
  });
}

/** The options the board list's filter dropdowns offer. */
export function useBoardFilterOptionsQuery() {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: queryKeys.filterOptions,
    queryFn: () => boardsApi.listFilterOptions(),
  });
}

/**
 * The board listing behind the home page widget. Keyed by its options so
 * the four setting combinations stay cached side by side; freshness comes
 * from the `boards` signal channel rather than `invalidateBoard`, which
 * only invalidates the exact `queryKeys.boards` entry. The widget renders
 * a plain list, so the page wrapper is unwrapped here.
 */
export function useBoardListQuery(options: {
  favoritesOnly: boolean;
  withCounts: boolean;
}) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: ['boards', 'list', options] as const,
    queryFn: () =>
      boardsApi.listBoards({
        favoritesOnly: options.favoritesOnly,
        withCounts: options.withCounts,
      }),
    select: result => result.boards,
  });
}

/** The current user's items across every board they can read. */
export function useMyItemsQuery() {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: queryKeys.myItems,
    queryFn: () => boardsApi.listMyItems(),
  });
}

/**
 * Reacts to the backend's board change signals. With a `boardId`, only
 * that board's signals are answered.
 */
export function useBoardsSignal(
  onSignal: () => void,
  options?: { boardId?: string },
): void {
  const { lastSignal } = useSignal<{ boardId?: string }>('boards');
  const onlyBoardId = options?.boardId;
  useEffect(() => {
    if (!lastSignal) {
      return;
    }
    if (onlyBoardId && lastSignal.boardId !== onlyBoardId) {
      return;
    }
    onSignal();
    // the callback is rebuilt every render; the signal is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSignal, onlyBoardId]);
}

export function useBoardsByEntityQuery(entityRef: string) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: ['boards', 'byEntity', entityRef],
    queryFn: () => boardsApi.listBoards({ entityRef }),
    select: result => result.boards,
  });
}

export function useBoardQuery(boardId: string) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: queryKeys.board(boardId),
    queryFn: () => boardsApi.getBoard(boardId),
  });
}

/**
 * The boards behind a set of entries, keyed by board id. Uses the same
 * query key as {@link useBoardQuery}, so a board the user already opened
 * costs nothing and two rows on one board share a single request.
 */
export function useBoardsQueries(
  boardIds: string[],
): Map<string, BoardWithContext> {
  const boardsApi = useApi(boardsApiRef);
  // `useQueries` takes a fresh array every render by design, and the
  // query keys are what decide whether anything is fetched
  const ids = [...new Set(boardIds)].sort();
  const results = useQueries({
    queries: ids.map(boardId => ({
      queryKey: queryKeys.board(boardId),
      queryFn: () => boardsApi.getBoard(boardId),
    })),
  });
  const boards = new Map<string, BoardWithContext>();
  ids.forEach((boardId, index) => {
    const board = results[index]?.data;
    if (board) {
      boards.set(boardId, board);
    }
  });
  return boards;
}

export function useItemsQuery(boardId: string) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: queryKeys.items(boardId),
    queryFn: () => boardsApi.listItems(boardId),
  });
}

/** Invalidates everything belonging to one board plus the board list. */
export async function invalidateBoard(
  client: QueryClient,
  boardId: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.board(boardId) }),
    client.invalidateQueries({ queryKey: queryKeys.items(boardId) }),
    client.invalidateQueries({ queryKey: queryKeys.boards, exact: true }),
    // the paged listing hangs off its own key, which the exact
    // invalidation above cannot reach
    client.invalidateQueries({ queryKey: queryKeys.boardsPage }),
  ]);
}

/**
 * Invalidates the my-items listing. `invalidateBoard` does not reach it:
 * it invalidates the board list key exactly, and my-items is a sibling.
 */
export async function invalidateMyItems(client: QueryClient): Promise<void> {
  await client.invalidateQueries({ queryKey: queryKeys.myItems });
}

/**
 * Shared machinery for the optimistic item mutations below: the item is
 * patched in the cache immediately, a server rejection rolls the cache
 * back and surfaces the error.
 */
function useOptimisticItemMutation<TInput extends { itemId: string }>(
  boardId: string,
  onError: (message: string) => void,
  options: {
    mutationFn: (input: TInput) => Promise<unknown>;
    /** The optimistic change applied to the item being mutated. */
    patch: (item: BoardItem, input: TInput) => BoardItem;
  },
) {
  const client = useQueryClient();
  const queryKey = queryKeys.items(boardId);
  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (input: TInput) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<BoardItem[]>(queryKey);
      client.setQueryData<BoardItem[]>(queryKey, items =>
        (items ?? []).map(item =>
          item.id === input.itemId ? options.patch(item, input) : item,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        client.setQueryData(queryKey, context.previous);
      }
      onError(errorMessage(error));
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Optimistic item move: the card lands in the target column immediately;
 * a server rejection rolls the cache back.
 */
export function useMoveItem(
  boardId: string,
  onError: (message: string) => void,
) {
  const boardsApi = useApi(boardsApiRef);
  return useOptimisticItemMutation<{
    itemId: string;
    columnId: string;
    position?: number;
  }>(boardId, onError, {
    mutationFn: input =>
      boardsApi.moveItem(boardId, input.itemId, {
        columnId: input.columnId,
        position: input.position,
      }),
    patch: (item, input) => ({
      ...item,
      columnId: input.columnId,
      position: input.position ?? item.position,
    }),
  });
}

/** Optimistic title rename. */
export function useRenameItem(
  boardId: string,
  onError: (message: string) => void,
) {
  const boardsApi = useApi(boardsApiRef);
  return useOptimisticItemMutation<{ itemId: string; title: string }>(
    boardId,
    onError,
    {
      mutationFn: input =>
        boardsApi.updateItem(boardId, input.itemId, { title: input.title }),
      patch: (item, input) => ({ ...item, title: input.title }),
    },
  );
}

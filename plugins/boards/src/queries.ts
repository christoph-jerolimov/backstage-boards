import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useApi } from '@backstage/frontend-plugin-api';
import { BoardItem } from '@internal/plugin-boards-common';
import { boardsApiRef } from './api';

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
  board: (boardId: string) => ['boards', boardId] as const,
  items: (boardId: string) => ['items', boardId] as const,
};

export function useBoardsQuery() {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: queryKeys.boards,
    queryFn: () => boardsApi.listBoards(),
  });
}

export function useBoardsByEntityQuery(entityRef: string) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: ['boards', 'byEntity', entityRef],
    queryFn: () => boardsApi.listBoards({ entityRef }),
  });
}

export function useBoardQuery(boardId: string) {
  const boardsApi = useApi(boardsApiRef);
  return useQuery({
    queryKey: queryKeys.board(boardId),
    queryFn: () => boardsApi.getBoard(boardId),
  });
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
  ]);
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
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      itemId: string;
      columnId: string;
      position?: number;
    }) =>
      boardsApi.moveItem(boardId, input.itemId, {
        columnId: input.columnId,
        position: input.position,
      }),
    onMutate: async input => {
      await client.cancelQueries({ queryKey: queryKeys.items(boardId) });
      const previous = client.getQueryData<BoardItem[]>(
        queryKeys.items(boardId),
      );
      client.setQueryData<BoardItem[]>(queryKeys.items(boardId), items =>
        (items ?? []).map(item =>
          item.id === input.itemId
            ? {
                ...item,
                columnId: input.columnId,
                position: input.position ?? item.position,
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.items(boardId), context.previous);
      }
      onError((error as Error).message);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.items(boardId) });
    },
  });
}

/** Optimistic title rename. */
export function useRenameItem(
  boardId: string,
  onError: (message: string) => void,
) {
  const boardsApi = useApi(boardsApiRef);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; title: string }) =>
      boardsApi.updateItem(boardId, input.itemId, { title: input.title }),
    onMutate: async input => {
      await client.cancelQueries({ queryKey: queryKeys.items(boardId) });
      const previous = client.getQueryData<BoardItem[]>(
        queryKeys.items(boardId),
      );
      client.setQueryData<BoardItem[]>(queryKeys.items(boardId), items =>
        (items ?? []).map(item =>
          item.id === input.itemId ? { ...item, title: input.title } : item,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.items(boardId), context.previous);
      }
      onError((error as Error).message);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.items(boardId) });
    },
  });
}

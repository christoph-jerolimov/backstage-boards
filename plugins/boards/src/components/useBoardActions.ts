import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '@backstage/frontend-plugin-api';
import { useQueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { invalidateBoard, useMoveItem, useRenameItem } from '../queries';
import type { BoardActions } from './BoardView';

/** The item shown in the drawer is kept in the `item` search param. */
export function useOpenItemParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  return useMemo(
    () => ({
      openItemId: searchParams.get('item') ?? undefined,
      openItem: (itemId: string) => {
        searchParams.set('item', itemId);
        setSearchParams(searchParams);
      },
      closeItem: () => {
        searchParams.delete('item');
        setSearchParams(searchParams);
      },
    }),
    [searchParams, setSearchParams],
  );
}

export interface BoardActionsHandle {
  /** The item and column actions handed to the board and table views. */
  actions: BoardActions;
  /** Runs a board-level mutation, refreshing after it and surfacing failures. */
  guarded: (action: () => Promise<unknown>) => Promise<void>;
  refreshAll: () => Promise<void>;
  /** The message of the last failed action, until the next refresh. */
  error?: string;
}

/**
 * Every mutation the board page can trigger, with the cache invalidation
 * and error reporting they share.
 */
export function useBoardActions(
  boardId: string,
  openItem: (itemId: string) => void,
): BoardActionsHandle {
  const boardsApi = useApi(boardsApiRef);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();

  const refreshAll = async () => {
    setError(undefined);
    await invalidateBoard(queryClient, boardId);
  };

  const guarded = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refreshAll();
    } catch (err) {
      // refresh directly: refreshAll() would clear the error again
      await invalidateBoard(queryClient, boardId);
      setError((err as Error).message);
    }
  };

  const moveItemMutation = useMoveItem(boardId, setError);
  const renameItemMutation = useRenameItem(boardId, setError);

  const actions: BoardActions = useMemo(
    () => ({
      // optimistic: cache updates immediately, server reconciles
      moveItem: async (itemId, target) => {
        setError(undefined);
        await moveItemMutation.mutateAsync({ itemId, ...target }).catch(() => {
          // error already surfaced via the mutation's onError
        });
      },
      renameItem: async (itemId, title) => {
        setError(undefined);
        await renameItemMutation.mutateAsync({ itemId, title }).catch(() => {
          // error already surfaced via the mutation's onError
        });
      },
      createItem: (columnId, title) =>
        guarded(() => boardsApi.createItem(boardId, { columnId, title })),
      renameColumn: (columnId, title) =>
        guarded(() => boardsApi.updateColumn(boardId, columnId, { title })),
      reorderColumn: (columnId, position) =>
        guarded(() => boardsApi.updateColumn(boardId, columnId, { position })),
      addColumn: (title, position) =>
        guarded(() => boardsApi.addColumn(boardId, { title, position })),
      setColumnColor: (columnId, color) =>
        guarded(() => boardsApi.updateColumn(boardId, columnId, { color })),
      deleteColumn: (columnId, moveItemsTo) =>
        guarded(() =>
          boardsApi.deleteColumn(boardId, columnId, { moveItemsTo }),
        ),
      setItemDueDate: (itemId, dueDate) =>
        guarded(() => boardsApi.updateItem(boardId, itemId, { dueDate })),
      setAssignees: (itemId, assignees) =>
        guarded(() => boardsApi.updateItem(boardId, itemId, { assignees })),
      deleteItem: itemId =>
        guarded(() => boardsApi.deleteItem(boardId, itemId)),
      openItem,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardsApi, boardId, openItem],
  );

  return { actions, guarded, refreshAll, error };
}

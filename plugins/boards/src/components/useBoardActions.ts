import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '@backstage/frontend-plugin-api';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, ItemUpdate } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { invalidateBoard, useMoveItem, useRenameItem } from '../queries';
import type { BoardActions } from './BoardView';
import { useAsyncAction } from './useAsyncAction';

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

/**
 * The fan-out mutations behind the table's bulk-actions bar. Each call
 * runs its per-item requests in parallel, refreshes the board once, and
 * keeps the items that succeeded even when others fail.
 */
export interface BulkActions {
  moveItems: (itemIds: string[], columnId: string) => Promise<void>;
  updateItems: (
    entries: { itemId: string; update: ItemUpdate }[],
  ) => Promise<void>;
  archiveItems: (itemIds: string[]) => Promise<void>;
}

export interface BoardActionsHandle {
  /** The item and column actions handed to the board and table views. */
  actions: BoardActions;
  /** The bulk mutations handed to the table view. */
  bulk: BulkActions;
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
  const { error, run, setError } = useAsyncAction();

  const refreshAll = async () => {
    setError(undefined);
    await invalidateBoard(queryClient, boardId);
  };

  const guarded = async (action: () => Promise<unknown>) => {
    const failure = await run(async () => {
      await action();
      await refreshAll();
    });
    if (failure) {
      // resync directly: refreshAll() would clear the error again
      await invalidateBoard(queryClient, boardId);
    }
  };

  const moveItemMutation = useMoveItem(boardId, setError);
  const renameItemMutation = useRenameItem(boardId, setError);

  // all calls settle before the one refresh, so the items that went
  // through render their new state even when a sibling call failed
  const fanOut = async (tasks: Array<() => Promise<unknown>>) => {
    setError(undefined);
    const results = await Promise.allSettled(tasks.map(task => task()));
    await invalidateBoard(queryClient, boardId);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) {
      setError(errorMessage(failure.reason));
    }
  };

  const bulk: BulkActions = useMemo(
    () => ({
      moveItems: (itemIds, columnId) =>
        fanOut(
          itemIds.map(
            itemId => () => boardsApi.moveItem(boardId, itemId, { columnId }),
          ),
        ),
      updateItems: entries =>
        fanOut(
          entries.map(
            ({ itemId, update }) =>
              () =>
                boardsApi.updateItem(boardId, itemId, update),
          ),
        ),
      archiveItems: itemIds =>
        fanOut(
          itemIds.map(itemId => () => boardsApi.deleteItem(boardId, itemId)),
        ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardsApi, boardId],
  );

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
      setItemPriority: (itemId, priorityId) =>
        guarded(() => boardsApi.updateItem(boardId, itemId, { priorityId })),
      deleteItem: itemId =>
        guarded(() => boardsApi.deleteItem(boardId, itemId)),
      openItem,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardsApi, boardId, openItem],
  );

  return { actions, bulk, guarded, refreshAll, error };
}

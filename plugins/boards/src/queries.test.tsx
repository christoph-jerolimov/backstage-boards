import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestApiProvider } from '@backstage/frontend-test-utils';
import { BoardItem } from '@internal/plugin-boards-common';
import { boardsApiRef } from './api';
import {
  invalidateBoard,
  queryKeys,
  useBoardListQuery,
  useBoardQuery,
  useBoardsByEntityQuery,
  useBoardsQuery,
  useItemsQuery,
  useMoveItem,
  useRenameItem,
} from './queries';
import {
  testBoardsApi,
  testItem,
} from './components/__testUtils__/testHelpers';

function setup(over: Parameters<typeof testBoardsApi>[0] = {}) {
  const boardsApi = testBoardsApi(over);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestApiProvider apis={[[boardsApiRef, boardsApi]]}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </TestApiProvider>
  );
  return { boardsApi, client, wrapper };
}

const items: BoardItem[] = [
  testItem({
    id: 'item-1',
    title: 'First',
    columnId: 'column-1',
    position: 1000,
  }),
  testItem({
    id: 'item-2',
    title: 'Second',
    columnId: 'column-1',
    position: 2000,
  }),
];

describe('query hooks', () => {
  it('loads the board list', async () => {
    const { boardsApi, wrapper } = setup({
      listBoards: jest.fn().mockResolvedValue([{ id: 'board-1' }]),
    } as any);
    const { result } = renderHook(() => useBoardsQuery(), { wrapper });
    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 'board-1' }]),
    );
    expect(boardsApi.listBoards).toHaveBeenCalledWith();
  });

  it('caches each widget setting combination separately', async () => {
    const { boardsApi, client, wrapper } = setup({
      listBoards: jest.fn().mockResolvedValue([{ id: 'board-1' }]),
    } as any);
    const combinations = [
      { favoritesOnly: false, withCounts: false },
      { favoritesOnly: false, withCounts: true },
      { favoritesOnly: true, withCounts: false },
      { favoritesOnly: true, withCounts: true },
    ];
    for (const options of combinations) {
      const { result } = renderHook(() => useBoardListQuery(options), {
        wrapper,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    }

    expect(client.getQueryCache().getAll()).toHaveLength(combinations.length);
    expect(boardsApi.listBoards).toHaveBeenCalledTimes(combinations.length);
    for (const options of combinations) {
      expect(boardsApi.listBoards).toHaveBeenCalledWith(options);
      expect(client.getQueryData(['boards', 'list', options] as const)).toEqual(
        [{ id: 'board-1' }],
      );
    }
  });

  it('leaves the widget list untouched when a board is invalidated', async () => {
    const { client } = setup();
    const options = { favoritesOnly: true, withCounts: true };
    client.setQueryData(['boards', 'list', options] as const, [
      { id: 'board-1' },
    ]);
    await invalidateBoard(client, 'board-1');
    expect(
      client.getQueryState(['boards', 'list', options] as const)?.isInvalidated,
    ).toBe(false);
  });

  it('loads the boards of one entity', async () => {
    const { boardsApi, wrapper } = setup();
    const { result } = renderHook(
      () => useBoardsByEntityQuery('component:default/www'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(boardsApi.listBoards).toHaveBeenCalledWith({
      entityRef: 'component:default/www',
    });
  });

  it('loads a single board and its items', async () => {
    const { boardsApi, wrapper } = setup({
      getBoard: jest.fn().mockResolvedValue({ id: 'board-1' }),
      listItems: jest.fn().mockResolvedValue(items),
    } as any);
    const board = renderHook(() => useBoardQuery('board-1'), { wrapper });
    const list = renderHook(() => useItemsQuery('board-1'), { wrapper });
    await waitFor(() =>
      expect(board.result.current.data).toEqual({ id: 'board-1' }),
    );
    await waitFor(() => expect(list.result.current.data).toEqual(items));
    expect(boardsApi.getBoard).toHaveBeenCalledWith('board-1');
    expect(boardsApi.listItems).toHaveBeenCalledWith('board-1');
  });
});

describe('invalidateBoard', () => {
  it('invalidates the board, its items and the board list', async () => {
    const { client } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await invalidateBoard(client, 'board-1');
    expect(invalidate.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: queryKeys.board('board-1') },
      { queryKey: queryKeys.items('board-1') },
      { queryKey: queryKeys.boards, exact: true },
    ]);
  });
});

describe('useMoveItem', () => {
  it('moves the card in the cache before the server answers', async () => {
    const { client, wrapper, boardsApi } = setup({
      moveItem: jest.fn().mockResolvedValue(undefined),
    } as any);
    client.setQueryData(queryKeys.items('board-1'), items);
    const onError = jest.fn();
    const { result } = renderHook(() => useMoveItem('board-1', onError), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        itemId: 'item-1',
        columnId: 'column-2',
        position: 500,
      }),
    );
    const cached = client.getQueryData<BoardItem[]>(queryKeys.items('board-1'));
    expect(cached?.find(item => item.id === 'item-1')).toMatchObject({
      columnId: 'column-2',
      position: 500,
    });
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-1', {
      columnId: 'column-2',
      position: 500,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('rolls the cache back and reports a rejection', async () => {
    const { client, wrapper } = setup({
      moveItem: jest.fn().mockRejectedValue(new Error('Column is locked')),
    } as any);
    client.setQueryData(queryKeys.items('board-1'), items);
    const onError = jest.fn();
    const { result } = renderHook(() => useMoveItem('board-1', onError), {
      wrapper,
    });

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'item-1', columnId: 'column-2' })
        .catch(() => {});
    });
    expect(client.getQueryData(queryKeys.items('board-1'))).toEqual(items);
    expect(onError).toHaveBeenCalledWith('Column is locked');
  });
});

describe('useRenameItem', () => {
  it('renames the card in the cache before the server answers', async () => {
    const { client, wrapper, boardsApi } = setup({
      updateItem: jest.fn().mockResolvedValue(undefined),
    } as any);
    client.setQueryData(queryKeys.items('board-1'), items);
    const { result } = renderHook(() => useRenameItem('board-1', jest.fn()), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({ itemId: 'item-2', title: 'Renamed' }),
    );
    const cached = client.getQueryData<BoardItem[]>(queryKeys.items('board-1'));
    expect(cached?.find(item => item.id === 'item-2')?.title).toBe('Renamed');
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-2', {
      title: 'Renamed',
    });
  });

  it('rolls the cache back and reports a rejection', async () => {
    const { client, wrapper } = setup({
      updateItem: jest.fn().mockRejectedValue(new Error('Title too long')),
    } as any);
    client.setQueryData(queryKeys.items('board-1'), items);
    const onError = jest.fn();
    const { result } = renderHook(() => useRenameItem('board-1', onError), {
      wrapper,
    });

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'item-2', title: 'Renamed' })
        .catch(() => {});
    });
    expect(client.getQueryData(queryKeys.items('board-1'))).toEqual(items);
    expect(onError).toHaveBeenCalledWith('Title too long');
  });
});

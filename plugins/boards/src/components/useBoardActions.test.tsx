import { act, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { BulkActions, useBoardActions } from './useBoardActions';
import {
  renderWithProviders,
  testBoardsApi,
  testItem,
} from './__testUtils__/testHelpers';

function Harness(props: { onBulk: (bulk: BulkActions) => void }) {
  const { bulk, error } = useBoardActions('board-1', jest.fn());
  props.onBulk(bulk);
  return <span>{error ?? 'no error'}</span>;
}

function renderBulk(boardsApi = testBoardsApi()) {
  let bulk: BulkActions | undefined;
  renderWithProviders(<Harness onBulk={handle => (bulk = handle)} />, {
    apis: [[boardsApiRef, boardsApi]],
  });
  return { boardsApi, bulk: bulk! };
}

/** The invalidations of the board's own query, across all spy calls. */
function boardInvalidations(spy: jest.SpyInstance) {
  return spy.mock.calls.filter(
    ([filters]) =>
      JSON.stringify(filters?.queryKey) ===
      JSON.stringify(queryKeys.board('board-1')),
  );
}

describe('useBoardActions bulk', () => {
  let invalidateSpy: jest.SpyInstance;

  beforeEach(() => {
    invalidateSpy = jest
      .spyOn(QueryClient.prototype, 'invalidateQueries')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    invalidateSpy.mockRestore();
  });

  it('moves every item and refreshes the board once', async () => {
    const { boardsApi, bulk } = renderBulk();
    boardsApi.moveItem.mockResolvedValue(testItem());
    await act(() => bulk.moveItems(['item-1', 'item-2'], 'column-2'));
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-1', {
      columnId: 'column-2',
    });
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-2', {
      columnId: 'column-2',
    });
    expect(boardInvalidations(invalidateSpy)).toHaveLength(1);
    expect(screen.getByText('no error')).toBeInTheDocument();
  });

  it('updates every entry with its own patch', async () => {
    const { boardsApi, bulk } = renderBulk();
    boardsApi.updateItem.mockResolvedValue(testItem());
    await act(() =>
      bulk.updateItems([
        { itemId: 'item-1', update: { priorityId: 'priority-1' } },
        { itemId: 'item-2', update: { priorityId: null } },
      ]),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      priorityId: 'priority-1',
    });
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-2', {
      priorityId: null,
    });
    expect(boardInvalidations(invalidateSpy)).toHaveLength(1);
  });

  it('archives every item', async () => {
    const { boardsApi, bulk } = renderBulk();
    await act(() => bulk.archiveItems(['item-1', 'item-2']));
    expect(boardsApi.deleteItem).toHaveBeenCalledWith('board-1', 'item-1');
    expect(boardsApi.deleteItem).toHaveBeenCalledWith('board-1', 'item-2');
    expect(boardInvalidations(invalidateSpy)).toHaveLength(1);
  });

  it('runs the whole batch and surfaces the failure of one call', async () => {
    const { boardsApi, bulk } = renderBulk();
    boardsApi.updateItem.mockImplementation(async (_boardId, itemId) => {
      if (itemId === 'item-1') {
        throw new Error('rejected by the server');
      }
      return testItem();
    });
    await act(() =>
      bulk.updateItems([
        { itemId: 'item-1', update: { assignees: [] } },
        { itemId: 'item-2', update: { assignees: [] } },
      ]),
    );
    // the sibling call still went through, and the board still refreshed
    expect(boardsApi.updateItem).toHaveBeenCalledTimes(2);
    expect(boardInvalidations(invalidateSpy)).toHaveLength(1);
    expect(screen.getByText('rejected by the server')).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardsApi, boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { ItemDrawerHost } from './ItemDrawerHost';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
  testColumn,
  testItem,
} from './__testUtils__/testHelpers';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const board = testBoard({
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done' }),
  ],
  access: 'write',
});

function renderHost(over: Partial<jest.Mocked<BoardsApi>> = {}) {
  const boardsApi = testBoardsApi({
    getBoard: jest.fn().mockResolvedValue(board),
    listItems: jest
      .fn()
      .mockResolvedValue([
        testItem({ title: 'Fresh title', dueDate: '2026-09-04' }),
      ]),
    ...over,
  });
  const onClose = jest.fn();
  renderWithProviders(
    <ItemDrawerHost
      boardId="board-1"
      itemId="item-1"
      fallbackItem={testItem({ title: 'Snapshot title' })}
      onClose={onClose}
    />,
    {
      apis: [[boardsApiRef, boardsApi]],
      mountedRoutes: { '/boards': rootRouteRef },
    },
  );
  return { boardsApi, onClose };
}

describe('ItemDrawerHost', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders the drawer with the board’s own fresh item', async () => {
    renderHost();
    expect(
      await screen.findByRole('dialog', { name: 'Item Fresh title' }),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the listing snapshot until the board’s items arrive', async () => {
    renderHost({
      listItems: jest.fn((_boardId: string) => new Promise(() => {})),
    });
    expect(
      await screen.findByRole('dialog', { name: 'Item Snapshot title' }),
    ).toBeInTheDocument();
  });

  it('opens read-only on a board the user can only read', async () => {
    renderHost({
      getBoard: jest.fn().mockResolvedValue({ ...board, access: 'read' }),
    });
    await screen.findByRole('dialog', { name: 'Item Fresh title' });
    expect(
      screen.queryByRole('textbox', { name: 'New comment' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit item title' }),
    ).not.toBeInTheDocument();
  });

  it('opens read-only on an archived board', async () => {
    renderHost({
      getBoard: jest
        .fn()
        .mockResolvedValue({ ...board, archivedAt: '2026-08-10T10:00:00Z' }),
    });
    await screen.findByRole('dialog', { name: 'Item Fresh title' });
    expect(
      screen.queryByRole('button', { name: 'Edit item title' }),
    ).not.toBeInTheDocument();
  });

  it('saves edits and refetches the board’s data', async () => {
    const { boardsApi } = renderHost();
    await screen.findByRole('dialog', { name: 'Item Fresh title' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove due date' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      dueDate: null,
    });
    // the invalidation refetches the still-mounted board and item queries
    await waitFor(() =>
      expect(boardsApi.listItems.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('closes through the drawer', async () => {
    const { onClose } = renderHost();
    await screen.findByRole('dialog', { name: 'Item Fresh title' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Close item details' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to navigating when the board cannot load', async () => {
    renderHost({
      getBoard: jest.fn().mockRejectedValue(new Error('Gone')),
    });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/boards/board-1?item=item-1'),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

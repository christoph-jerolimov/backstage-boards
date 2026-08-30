import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { MoveItemDialog } from './MoveItemDialog';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
  testColumn,
  testItem,
} from './__testUtils__/testHelpers';

const sourceBoard = testBoard({ id: 'board-1', name: 'Source' });
const targetBoard = testBoard({
  id: 'board-2',
  name: 'Target',
  access: 'write',
  columns: [
    testColumn({ id: 'target-col-1', title: 'Inbox' }),
    testColumn({ id: 'target-col-2', title: 'Later', position: 2000 }),
  ],
});

function renderDialog(over: { boards?: Array<Record<string, unknown>> } = {}) {
  const boardsApi = testBoardsApi({
    listBoards: jest.fn().mockResolvedValue({
      boards: over.boards ?? [
        { ...sourceBoard, access: 'admin', favorite: false },
        { ...targetBoard, favorite: false },
        {
          ...testBoard({ id: 'board-3', name: 'Read only' }),
          access: 'read',
          favorite: false,
        },
      ],
      total: 3,
    }),
    getBoard: jest.fn().mockResolvedValue(targetBoard),
  });
  (boardsApi.moveItemToBoard as jest.Mock).mockResolvedValue(
    testItem({ id: 'item-moved' }),
  );
  const onClose = jest.fn();
  const onMoved = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <MoveItemDialog
      board={sourceBoard}
      item={testItem({ id: 'item-1', title: 'Migrating' })}
      onClose={onClose}
      onMoved={onMoved}
    />,
    { apis: [[boardsApiRef, boardsApi]] },
  );
  return { boardsApi, onClose, onMoved };
}

describe('MoveItemDialog', () => {
  it('walks board, then column, then moves', async () => {
    const { boardsApi, onClose, onMoved } = renderDialog();
    expect(
      screen.getByText('Move “Migrating” to another board'),
    ).toBeInTheDocument();
    const moveButton = screen.getByRole('button', { name: 'Move' });
    expect(moveButton).toBeDisabled();

    await userEvent.click(
      await screen.findByRole('button', { name: /Target board/ }),
    );
    // only writable other boards are offered
    expect(
      screen.queryByRole('option', { name: 'Source' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Read only' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole('option', { name: 'Target' }),
    );

    expect(moveButton).toBeDisabled();
    await userEvent.click(
      await screen.findByRole('button', { name: /Target column/ }),
    );
    await userEvent.click(await screen.findByRole('option', { name: 'Later' }));

    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(boardsApi.moveItemToBoard).toHaveBeenCalledWith(
      'board-1',
      'item-1',
      { targetBoardId: 'board-2', targetColumnId: 'target-col-2' },
    );
    expect(onMoved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('reports a failed move and stays open', async () => {
    const { boardsApi, onClose } = renderDialog();
    (boardsApi.moveItemToBoard as jest.Mock).mockRejectedValue(
      new Error('Column "Inbox" is at its WIP limit of 1'),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Target board/ }),
    );
    await userEvent.click(
      await screen.findByRole('option', { name: 'Target' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Target column/ }),
    );
    await userEvent.click(await screen.findByRole('option', { name: 'Inbox' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(await screen.findByText(/WIP limit of 1/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

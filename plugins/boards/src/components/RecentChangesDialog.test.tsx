import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { RecentChangesDialog } from './RecentChangesDialog';
import {
  renderWithProviders,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const changes = [
  {
    itemTitle: 'Ship the docs',
    change: {
      id: 'change-1',
      itemId: 'item-1',
      actorRef: 'user:default/jane',
      type: 'created',
      at: '2026-08-20T10:00:00.000Z',
    },
  },
  {
    itemTitle: 'Fix the build',
    change: {
      id: 'change-2',
      itemId: 'item-2',
      actorRef: 'text:CI bot',
      type: 'moved',
      oldValue: 'Todo',
      newValue: 'Done',
      at: '2026-08-21T10:00:00.000Z',
    },
  },
];

function renderDialog(over: { isOpen?: boolean; entries?: unknown[] } = {}) {
  const boardsApi = testBoardsApi({
    getBoardChanges: jest.fn().mockResolvedValue(over.entries ?? changes),
  });
  const onOpenChange = jest.fn();
  const onOpenItem = jest.fn();
  renderWithProviders(
    <RecentChangesDialog
      boardId="board-1"
      isOpen={over.isOpen ?? true}
      onOpenChange={onOpenChange}
      onOpenItem={onOpenItem}
    />,
    { apis: [[boardsApiRef, boardsApi]] },
  );
  return { boardsApi, onOpenChange, onOpenItem };
}

describe('RecentChangesDialog', () => {
  it('does not load anything while closed', () => {
    const { boardsApi } = renderDialog({ isOpen: false });
    expect(boardsApi.getBoardChanges).not.toHaveBeenCalled();
    expect(screen.queryByText('Recent changes')).not.toBeInTheDocument();
  });

  it('shows the newest changes in a table', async () => {
    const { boardsApi } = renderDialog();
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(boardsApi.getBoardChanges).toHaveBeenCalledWith('board-1', {
      limit: 50,
    });
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toEqual(['Item', 'Actor', 'Change', 'When']);
    expect(screen.getByText('Ship the docs')).toBeInTheDocument();
    expect(screen.getByText('created this item')).toBeInTheDocument();
    expect(
      screen.getByText('moved this item from “Todo” to “Done”'),
    ).toBeInTheDocument();
    expect(screen.getByText('CI bot')).toBeInTheDocument();
  });

  it('opens the item of a clicked row and closes itself', async () => {
    const { onOpenChange, onOpenItem } = renderDialog();
    const row = await screen.findByRole('row', { name: /Fix the build/ });
    await userEvent.click(row);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenItem).toHaveBeenCalledWith('item-2');
  });

  it('says so when nothing changed yet', async () => {
    renderDialog({ entries: [] });
    expect(
      await screen.findByText('No changes recorded yet.'),
    ).toBeInTheDocument();
  });
});

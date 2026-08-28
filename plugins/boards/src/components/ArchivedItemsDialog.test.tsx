import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { ArchivedItemsDialog } from './ArchivedItemsDialog';
import { formatDate } from './common';
import {
  renderWithProviders,
  testBoardsApi,
  testItem,
} from './__testUtils__/testHelpers';

const archived = [
  testItem({
    id: 'item-1',
    title: 'Old task',
    archivedAt: '2026-08-01T10:00:00.000Z',
    archivedBy: 'user:default/jane',
  }),
];

function renderDialog(
  over: { isOpen?: boolean; canWrite?: boolean; items?: unknown[] } = {},
) {
  const boardsApi = testBoardsApi({
    listArchivedItems: jest.fn().mockResolvedValue(over.items ?? archived),
    restoreItem: jest.fn().mockResolvedValue(undefined),
  });
  const onChanged = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <ArchivedItemsDialog
      boardId="board-1"
      canWrite={over.canWrite ?? true}
      isOpen={over.isOpen ?? true}
      onOpenChange={jest.fn()}
      onChanged={onChanged}
    />,
    { apis: [[boardsApiRef, boardsApi]] },
  );
  return { boardsApi, onChanged };
}

describe('ArchivedItemsDialog', () => {
  it('does not load anything while closed', () => {
    const { boardsApi } = renderDialog({ isOpen: false });
    expect(boardsApi.listArchivedItems).not.toHaveBeenCalled();
  });

  it('does not load anything for readers', async () => {
    const { boardsApi } = renderDialog({ canWrite: false });
    expect(boardsApi.listArchivedItems).not.toHaveBeenCalled();
    expect(await screen.findByText('Loading…')).toBeInTheDocument();
  });

  it('lists the archived items in a table with who archived them and when', async () => {
    renderDialog();
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toEqual(['Title', 'Archived by', 'Archived', 'Actions']);
    expect(
      screen.getByText('Archived items are removed permanently after 30 days.'),
    ).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /Old task/ });
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Old task');
    const [archivedBy, archivedAt] = within(row).getAllByRole('gridcell');
    expect(within(archivedBy).getByRole('link')).toHaveTextContent('jane');
    expect(archivedAt).toHaveTextContent(
      formatDate('2026-08-01T10:00:00.000Z'),
    );
  });

  it('restores an item and refreshes the board', async () => {
    const { boardsApi, onChanged } = renderDialog();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Restore' }),
    );
    expect(boardsApi.restoreItem).toHaveBeenCalledWith('board-1', 'item-1');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(boardsApi.listArchivedItems).toHaveBeenCalledTimes(2);
  });

  it('says so when nothing is archived', async () => {
    renderDialog({ items: [] });
    expect(await screen.findByText('No archived items.')).toBeInTheDocument();
  });
});

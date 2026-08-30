import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardDocument } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ImportBoardDialog } from './ImportBoardDialog';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const document: BoardDocument = {
  format: 'backstage-boards',
  version: 1,
  board: {
    name: 'Imported',
    columns: [{ title: 'Todo' }, { title: 'Done' }],
    priorities: [],
  },
  items: [{ title: 'One', status: 'Todo' }],
};

function renderDialog() {
  const boardsApi = testBoardsApi();
  (boardsApi.importBoard as jest.Mock).mockResolvedValue(
    testBoard({ id: 'board-new' }),
  );
  const onImported = jest.fn();
  const onOpenChange = jest.fn();
  renderWithProviders(
    <ImportBoardDialog
      isOpen
      onOpenChange={onOpenChange}
      onImported={onImported}
    />,
    { apis: [[boardsApiRef, boardsApi]] },
  );
  return { boardsApi, onImported, onOpenChange };
}

function documentFile(content: unknown) {
  return new File([JSON.stringify(content)], 'board.json', {
    type: 'application/json',
  });
}

describe('ImportBoardDialog', () => {
  it('previews the document and imports it', async () => {
    const { boardsApi, onImported } = renderDialog();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    await userEvent.upload(
      screen.getByLabelText('Board document'),
      documentFile(document),
    );
    expect(
      await screen.findByText(/“Imported” — 2 columns, 1 items/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(boardsApi.importBoard).toHaveBeenCalledWith(document);
    expect(onImported).toHaveBeenCalledWith('board-new');
  });

  it('rejects a file that is not a boards export', async () => {
    renderDialog();
    await userEvent.upload(
      screen.getByLabelText('Board document'),
      documentFile({ something: 'else' }),
    );
    expect(
      await screen.findByText(/Not a backstage-boards export/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});

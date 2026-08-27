import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardPermissionLevel } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { DuplicateBoardDialog } from './DuplicateBoardDialog';
import { renderWithProviders, testBoardsApi } from './__testUtils__/testHelpers';

function renderDialog(
  over: { access?: BoardPermissionLevel; boardsApi?: any } = {},
) {
  const boardsApi =
    over.boardsApi ??
    testBoardsApi({
      duplicateBoard: jest.fn().mockResolvedValue({ id: 'board-2' }),
    } as any);
  const onOpenChange = jest.fn();
  renderWithProviders(
    <DuplicateBoardDialog
      board={
        {
          id: 'board-1',
          name: 'Roadmap',
          access: over.access ?? 'write',
        } as any
      }
      isOpen
      onOpenChange={onOpenChange}
    />,
    {
      apis: [[boardsApiRef, boardsApi]],
      mountedRoutes: { '/boards': rootRouteRef },
    },
  );
  return { boardsApi, onOpenChange };
}

/** Checkbox inputs are visually hidden, so the label is what gets clicked. */
function toggle(label: string | RegExp) {
  return userEvent.click(screen.getByText(label));
}

describe('DuplicateBoardDialog', () => {
  it('proposes a name for the copy', () => {
    renderDialog();
    expect(screen.getByText('Duplicate “Roadmap”')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name of the copy' })).toHaveValue(
      'Roadmap (copy)',
    );
  });

  it('copies the columns but not the items by default', async () => {
    const { boardsApi, onOpenChange } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(boardsApi.duplicateBoard).toHaveBeenCalledWith('board-1', {
      name: 'Roadmap (copy)',
      copyColumns: true,
      copyItems: false,
      copyEntities: false,
      copyPermissions: false,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('passes the chosen options', async () => {
    const { boardsApi } = renderDialog();
    const name = screen.getByRole('textbox', { name: 'Name of the copy' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Next quarter');
    await toggle(/Copy items/);
    await toggle(/Copy entity references/);
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(boardsApi.duplicateBoard).toHaveBeenCalledWith('board-1', {
      name: 'Next quarter',
      copyColumns: true,
      copyItems: true,
      copyEntities: true,
      copyPermissions: false,
    });
  });

  it('drops the items when the columns are not copied', async () => {
    const { boardsApi } = renderDialog();
    await toggle(/Copy items/);
    await toggle(/Copy columns/);
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(boardsApi.duplicateBoard).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({ copyColumns: false, copyItems: false }),
    );
  });

  it('offers to copy the share settings to admins only', async () => {
    renderDialog({ access: 'write' });
    expect(screen.queryByText(/Copy share settings/)).not.toBeInTheDocument();
  });

  it('copies the share settings when an admin asks for it', async () => {
    const { boardsApi } = renderDialog({ access: 'admin' });
    await toggle(/Copy share settings/);
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(boardsApi.duplicateBoard).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({ copyPermissions: true }),
    );
  });

  it('falls back to no name when the field is cleared', async () => {
    const { boardsApi } = renderDialog();
    await userEvent.clear(
      screen.getByRole('textbox', { name: 'Name of the copy' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(boardsApi.duplicateBoard).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({ name: undefined }),
    );
  });

  it('shows why duplicating failed and stays open', async () => {
    const boardsApi = testBoardsApi({
      duplicateBoard: jest.fn().mockRejectedValue(new Error('Quota reached')),
    } as any);
    const { onOpenChange } = renderDialog({ boardsApi });
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText('Quota reached')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes on cancel without duplicating', async () => {
    const { boardsApi, onOpenChange } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(boardsApi.duplicateBoard).not.toHaveBeenCalled();
  });
});

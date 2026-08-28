import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  BoardPermissionLevel,
  BoardVisibility,
} from '@internal/plugin-boards-common';
import { boardsApiRef, BoardsApi } from '../api';
import { ShareDialog } from './ShareDialog';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [{ kind: 'User', metadata: { namespace: 'default', name: 'bob' } }],
  }),
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
};

const permissions = [
  { id: 'perm-1', principalRef: 'user:default/jane', level: 'write' },
];

function renderDialog(
  over: {
    boardsApi?: jest.Mocked<BoardsApi>;
    access?: BoardPermissionLevel;
    visibility?: BoardVisibility;
  } = {},
) {
  const boardsApi =
    over.boardsApi ??
    testBoardsApi({
      listPermissions: jest.fn().mockResolvedValue(permissions),
    });
  const onChanged = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <ShareDialog
      board={testBoard({
        access: over.access ?? 'admin',
        visibility: over.visibility ?? 'private',
      })}
      isOpen
      onOpenChange={jest.fn()}
      onChanged={onChanged}
    />,
    {
      apis: [
        [boardsApiRef, boardsApi],
        [catalogApiRef, catalogApi],
      ],
    },
  );
  return { boardsApi, onChanged };
}

/**
 * BUI fields that carry both `label` and `aria-label` compute their
 * accessible name from the visible label, so tests address them by the
 * aria-label attribute instead.
 */
function byLabel(ariaLabel: string): HTMLElement {
  const element = document.querySelector(`[aria-label="${ariaLabel}"]`);
  return element instanceof HTMLElement
    ? element
    : screen.getByRole('button', { name: new RegExp(ariaLabel) });
}

/** Picks an option from a BUI Select. */
async function pick(ariaLabel: string, optionName: string) {
  await userEvent.click(byLabel(ariaLabel));
  await userEvent.click(
    await screen.findByRole('option', { name: optionName }),
  );
}

describe('ShareDialog', () => {
  it('lists the people the board is shared with', async () => {
    renderDialog();
    expect(screen.getByText('Share “Roadmap”')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'jane' }),
    ).toBeInTheDocument();
  });

  it('does not load the permissions for non-admins', async () => {
    const boardsApi = testBoardsApi({
      listPermissions: jest.fn().mockResolvedValue(permissions),
    });
    renderDialog({ boardsApi, access: 'write' });
    await waitFor(() =>
      expect(screen.getByText('People and groups')).toBeInTheDocument(),
    );
    expect(boardsApi.listPermissions).not.toHaveBeenCalled();
  });

  it('changes the board visibility', async () => {
    const { boardsApi, onChanged } = renderDialog();
    await pick('Board visibility', 'Any logged-in user can view');
    expect(boardsApi.updateBoard).toHaveBeenCalledWith('board-1', {
      visibility: 'logged-in-read',
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('changes the level of an existing entry', async () => {
    const { boardsApi } = renderDialog();
    await screen.findByRole('link', { name: 'jane' });
    await pick('Access level for user:default/jane', 'admin');
    expect(boardsApi.updatePermission).toHaveBeenCalledWith(
      'board-1',
      'perm-1',
      'admin',
    );
  });

  it('removes an entry', async () => {
    const { boardsApi } = renderDialog();
    await screen.findByRole('link', { name: 'jane' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(boardsApi.removePermission).toHaveBeenCalledWith(
      'board-1',
      'perm-1',
    );
  });

  it('cannot add before a principal is picked', async () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('adds a principal with the chosen level', async () => {
    const { boardsApi } = renderDialog();
    await userEvent.type(byLabel('Add user or group'), 'bob');
    await userEvent.click(await screen.findByRole('option'));
    await pick('Level for new entry', 'admin');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(boardsApi.addPermission).toHaveBeenCalledWith('board-1', {
      principalRef: 'user:default/bob',
      level: 'admin',
    });
  });

  it('shows why a change was rejected', async () => {
    const boardsApi = testBoardsApi({
      listPermissions: jest.fn().mockResolvedValue(permissions),
      updateBoard: jest.fn().mockRejectedValue(new Error('Not an admin')),
    });
    renderDialog({ boardsApi });
    await pick('Board visibility', 'Public – anyone can edit');
    expect(await screen.findByText('Not an admin')).toBeInTheDocument();
  });
});

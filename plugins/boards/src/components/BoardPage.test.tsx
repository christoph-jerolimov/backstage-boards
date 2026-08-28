import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { boardsApiRef, BoardsApi } from '../api';
import { rootRouteRef } from '../routes';
import { BoardPageContent } from './BoardPage';
import {
  renderWithProviders,
  testBoardsApi,
  testColumn,
  testItem,
} from './__testUtils__/testHelpers';

const identityApi = {
  getBackstageIdentity: async () => ({
    type: 'user',
    userEntityRef: 'user:default/alice',
    ownershipEntityRefs: ['user:default/alice'],
  }),
};

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({ items: [] }),
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
};

const board = {
  id: 'board-1',
  name: 'Roadmap',
  access: 'admin',
  favorite: false,
  watching: false,
  visibility: 'private',
  entityRefs: ['component:default/www'],
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done', position: 2000 }),
  ],
};

const items = [
  testItem({ id: 'item-1', title: 'Ship the docs', tags: ['docs'] }),
  testItem({ id: 'item-2', title: 'Fix the build', columnId: 'column-2' }),
];

function renderBoard(
  over: {
    board?: Record<string, unknown>;
    items?: typeof items;
    boardsApi?: jest.Mocked<BoardsApi>;
    boardError?: Error;
    embedded?: boolean;
  } = {},
) {
  const boardsApi =
    over.boardsApi ??
    testBoardsApi({
      getBoard: over.boardError
        ? jest.fn().mockRejectedValue(over.boardError)
        : jest.fn().mockResolvedValue({ ...board, ...over.board }),
      listItems: jest.fn().mockResolvedValue(over.items ?? items),
    });
  renderWithProviders(
    <BoardPageContent boardId="board-1" embedded={over.embedded} />,
    {
      apis: [
        [boardsApiRef, boardsApi],
        [identityApiRef, identityApi],
        [catalogApiRef, catalogApi],
      ],
      mountedRoutes: { '/boards': rootRouteRef },
    },
  );
  return { boardsApi };
}

async function openBoardMenu() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'More board actions' }),
  );
  await screen.findByRole('menuitem', { name: 'Recent changes…' });
}

describe('BoardPage loading', () => {
  it('shows a loading state first', () => {
    renderBoard();
    expect(screen.getByText('Loading board…')).toBeInTheDocument();
  });

  it('reports a board that could not be loaded', async () => {
    renderBoard({ boardError: new Error('Forbidden') });
    expect(
      await screen.findByText('Board could not be loaded: Forbidden'),
    ).toBeInTheDocument();
  });
});

describe('BoardPage header', () => {
  it('shows the board with its entities and access', async () => {
    renderBoard();
    expect(
      await screen.findByRole('heading', { name: 'Roadmap' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'www' }),
    ).toBeInTheDocument();
    expect(screen.getByText('· your access: admin')).toBeInTheDocument();
  });

  it('says when no entity is referenced', async () => {
    renderBoard({ board: { entityRefs: [] } });
    expect(await screen.findByText('none')).toBeInTheDocument();
  });

  it('renames the board', async () => {
    const { boardsApi } = renderBoard();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit board name' }),
    );
    const field = screen.getByRole('textbox', { name: 'board name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Next quarter{Enter}');
    expect(boardsApi.updateBoard).toHaveBeenCalledWith('board-1', {
      name: 'Next quarter',
    });
  });

  it('toggles the favorite', async () => {
    const { boardsApi } = renderBoard();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add to favorites' }),
    );
    expect(boardsApi.setFavorite).toHaveBeenCalledWith('board-1', true);
  });

  it('toggles the board watch', async () => {
    const { boardsApi } = renderBoard();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Watch this board' }),
    );
    expect(boardsApi.setWatchBoard).toHaveBeenCalledWith('board-1', true);
  });

  it('surfaces a failing action', async () => {
    const boardsApi = testBoardsApi({
      getBoard: jest.fn().mockResolvedValue(board),
      listItems: jest.fn().mockResolvedValue(items),
      setFavorite: jest.fn().mockRejectedValue(new Error('Read-only')),
    });
    renderBoard({ boardsApi });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add to favorites' }),
    );
    expect(await screen.findByText('Read-only')).toBeInTheDocument();
  });
});

describe('BoardPage views', () => {
  it('starts on the board view and switches to the table', async () => {
    renderBoard();
    expect(await screen.findByText('Todo (1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Table view' }));
    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('groups the items on request', async () => {
    renderBoard();
    await screen.findByText('Todo (1)');
    await userEvent.click(screen.getByRole('button', { name: /Group by/ }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'By tags' }),
    );
    expect(await screen.findByText('Untagged')).toBeInTheDocument();
  });
});

describe('BoardPage filtering', () => {
  it('filters by text and reports how many items match', async () => {
    renderBoard();
    await screen.findByText('Todo (1)');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search items' }),
      'docs',
    );
    expect(await screen.findByText('1 of 2 items')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Fix the build' }),
    ).not.toBeInTheDocument();
  });

  it('filters by tag and clears every filter again', async () => {
    renderBoard();
    await screen.findByText('Todo (1)');
    await userEvent.click(screen.getByRole('button', { name: 'Tags' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'docs' }),
    );
    expect(await screen.findByText('1 of 2 items')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tags (1)' }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('1 of 2 items')).not.toBeInTheDocument(),
    );
  });

  it('offers no tag filter when no item is tagged', async () => {
    renderBoard({ items: [testItem({ tags: [] })] });
    await screen.findByText('Todo (1)');
    expect(
      screen.queryByRole('button', { name: 'Tags' }),
    ).not.toBeInTheDocument();
  });
});

describe('BoardPage actions menu', () => {
  it('offers every entry to admins', async () => {
    renderBoard();
    await openBoardMenu();
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Recent changes…',
      'Archived items…',
      'Duplicate board…',
      'Board settings…',
      'Share…',
      'Archive board…',
    ]);
  });

  it('hides the admin entries from writers', async () => {
    renderBoard({ board: { access: 'write' } });
    await openBoardMenu();
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Recent changes…', 'Archived items…', 'Duplicate board…']);
  });

  it('opens the recent changes dialog', async () => {
    const { boardsApi } = renderBoard();
    await openBoardMenu();
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Recent changes…' }),
    );
    await waitFor(() => expect(boardsApi.getBoardChanges).toHaveBeenCalled());
  });

  it('archives the board after confirmation', async () => {
    const { boardsApi } = renderBoard();
    await openBoardMenu();
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Archive board…' }),
    );
    expect(
      await screen.findByText('Archive board “Roadmap”'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Archive board', hidden: true }),
    );
    expect(boardsApi.deleteBoard).toHaveBeenCalledWith('board-1');
  });
});

describe('BoardPage archived state', () => {
  const archivedBoard = { archivedAt: '2026-08-01T10:00:00.000Z' };

  it('warns that the board is read-only and offers to unarchive it', async () => {
    const { boardsApi } = renderBoard({ board: archivedBoard });
    expect(
      await screen.findByText('This board is archived and read-only'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unarchive' }));
    expect(boardsApi.unarchiveBoard).toHaveBeenCalledWith('board-1');
  });

  it('deletes an archived board immediately', async () => {
    const { boardsApi } = renderBoard({ board: archivedBoard });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete now' }),
    );
    expect(
      await screen.findByText('Permanently delete “Roadmap”'),
    ).toBeInTheDocument();
    // the alert's button and the dialog's confirm share the label
    const confirms = screen.getAllByRole('button', {
      name: 'Delete now',
      hidden: true,
    });
    await userEvent.click(confirms[confirms.length - 1]);
    expect(boardsApi.hardDeleteBoard).toHaveBeenCalledWith('board-1');
  });

  it('keeps an archived board read-only', async () => {
    renderBoard({ board: archivedBoard });
    await screen.findByText('Todo (1)');
    expect(
      screen.queryByRole('button', { name: 'Add item' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit board name' }),
    ).not.toBeInTheDocument();
  });
});

describe('BoardPage item drawer', () => {
  it('opens and closes the drawer for a clicked item', async () => {
    renderBoard();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ship the docs' }),
    );
    const drawer = await screen.findByRole('dialog', {
      name: 'Item Ship the docs',
    });
    expect(drawer).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Close item details' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Item Ship the docs' }),
      ).not.toBeInTheDocument(),
    );
  });
});

import { screen, waitFor, within } from '@testing-library/react';
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
  testPriorities,
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
  priorities: [],
};

const items = [
  testItem({ id: 'item-1', title: 'Ship the docs', tags: ['docs'] }),
  testItem({ id: 'item-2', title: 'Fix the build', columnId: 'column-2' }),
];

const assignedItems = [
  testItem({
    id: 'item-1',
    title: 'Bobs task',
    tags: ['docs'],
    assignees: ['user:default/bob'],
  }),
  testItem({
    id: 'item-2',
    title: 'Janes task',
    assignees: ['text:Jane (agency)'],
  }),
  testItem({
    id: 'item-3',
    title: 'Zoes task',
    columnId: 'column-2',
    tags: ['ui'],
    assignees: ['user:default/adams'],
  }),
];

/** Resolves the two catalog assignees of `assignedItems` to display names. */
function assigneeCatalogApi() {
  const profiles: Record<string, string> = {
    'user:default/adams': 'Zoe Zander',
    'user:default/bob': 'Bob Builder',
  };
  return {
    getEntities: jest.fn().mockResolvedValue({ items: [] }),
    getEntitiesByRefs: jest.fn(async (request: { entityRefs: string[] }) => ({
      items: request.entityRefs.map(ref => ({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'User',
        metadata: { name: ref.split('/')[1], namespace: 'default' },
        spec: { profile: { displayName: profiles[ref] } },
      })),
    })),
  };
}

function renderBoard(
  over: {
    board?: Record<string, unknown>;
    items?: typeof items;
    boardsApi?: jest.Mocked<BoardsApi>;
    boardError?: Error;
    embedded?: boolean;
    catalogApi?: unknown;
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
        [catalogApiRef, over.catalogApi ?? catalogApi],
      ],
      mountedRoutes: { '/boards': rootRouteRef },
    },
  );
  return { boardsApi };
}

/** Toggles one assignee; the menu closes after every selection. */
async function toggleAssignee(label: string, selected = 0) {
  await userEvent.click(
    screen.getByRole('button', {
      name: selected > 0 ? `Assignees (${selected})` : 'Assignees',
    }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: label }));
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

  it('offers exactly the board’s assignees, by display name', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    await screen.findByText('Todo (2)');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Assignees' }),
    );
    const entries = (await screen.findAllByRole('menuitem')).map(
      entry => entry.textContent,
    );
    // sorted by label, not by ref, and nobody who is not on this board
    expect(entries).toEqual(['Bob Builder', 'Jane (agency)', 'Zoe Zander']);
  });

  it('carries the full ref on catalog filter entries only', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    await screen.findByText('Todo (2)');
    await userEvent.click(screen.getByRole('button', { name: 'Assignees' }));
    const bob = await screen.findByRole('menuitem', { name: 'Bob Builder' });
    expect(bob.querySelector('[title]')).toHaveAttribute(
      'title',
      'user:default/bob',
    );
    expect(
      screen
        .getByRole('menuitem', { name: 'Jane (agency)' })
        .querySelector('[title]'),
    ).toBeNull();
  });

  it('keeps items of any selected assignee', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    await screen.findByText('Todo (2)');
    await toggleAssignee('Bob Builder');
    expect(await screen.findByText('1 of 3 items')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Zoes task' }),
    ).not.toBeInTheDocument();

    await toggleAssignee('Jane (agency)', 1);
    expect(await screen.findByText('2 of 3 items')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Bobs task' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Janes task' }),
    ).toBeInTheDocument();

    // deselecting the ticked entry drops it from the filter again
    await toggleAssignee('✓ Bob Builder', 2);
    expect(await screen.findByText('1 of 3 items')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Bobs task' }),
    ).not.toBeInTheDocument();
  });

  it('combines the assignee filter with tags, and clears it', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    await screen.findByText('Todo (2)');
    await toggleAssignee('Bob Builder');
    await userEvent.click(screen.getByRole('button', { name: 'Tags' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ui' }));
    // Bob holds the 'docs' item, 'ui' is Zoe's: the AND leaves nothing
    expect(await screen.findByText('0 of 3 items')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('0 of 3 items')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Assignees' }),
    ).toBeInTheDocument();
  });

  it('applies the assignee filter to the table view too', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    await screen.findByText('Todo (2)');
    await toggleAssignee('Bob Builder');
    await userEvent.click(screen.getByRole('radio', { name: 'Table view' }));
    const grid = await screen.findByRole('grid');
    expect(within(grid).getByText('Bobs task')).toBeInTheDocument();
    expect(within(grid).queryByText('Janes task')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Zoes task')).not.toBeInTheDocument();
  });

  it('counts and clears an assignee-only filter', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    await screen.findByText('Todo (2)');
    await toggleAssignee('Zoe Zander');
    expect(await screen.findByText('1 of 3 items')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Clear filters' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Assignees' }),
    ).toBeInTheDocument();
  });

  it('offers no assignee filter when no item has an assignee', async () => {
    renderBoard();
    await screen.findByText('Todo (1)');
    expect(
      screen.queryByRole('button', { name: 'Assignees' }),
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
      'Assignee matrix…',
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
    ).toEqual([
      'Recent changes…',
      'Archived items…',
      'Assignee matrix…',
      'Duplicate board…',
    ]);
  });

  it('offers the priority matrix only on boards with priorities', async () => {
    renderBoard({ board: { priorities: testPriorities() } });
    await openBoardMenu();
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Priority matrix…' }),
    );
    expect(
      await screen.findByRole('table', { name: 'Priority matrix' }),
    ).toBeInTheDocument();
  });

  it('counts only the filtered items in the assignee matrix', async () => {
    renderBoard({ items: assignedItems, catalogApi: assigneeCatalogApi() });
    // Bob's item is the only one tagged "docs"
    await userEvent.click(await screen.findByRole('button', { name: 'Tags' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'docs' }),
    );
    await openBoardMenu();
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Assignee matrix…' }),
    );
    const table = await screen.findByRole('table', { name: 'Assignee matrix' });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map(header => header.textContent),
    ).toEqual(['Bob Builder', 'Sum']);
    // Todo, Done, Sum — only the filtered item is counted
    expect(
      within(within(table).getAllByRole('row')[2])
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['1', '0', '1']);
  });

  it('offers no priority matrix entry without priorities', async () => {
    renderBoard();
    await openBoardMenu();
    expect(
      screen.queryByRole('menuitem', { name: 'Priority matrix…' }),
    ).not.toBeInTheDocument();
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

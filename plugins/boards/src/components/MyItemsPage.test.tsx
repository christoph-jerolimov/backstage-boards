import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef, storageApiRef } from '@backstage/frontend-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';
import { BoardPermissionLevel, todayISO } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { MyItemsList } from './MyItemsPage';
import {
  renderWithProviders,
  testBoardsApi,
  testColumn,
  testItem,
  testPriorities,
  testPriority,
} from './__testUtils__/testHelpers';

const identityApi = {
  getBackstageIdentity: async () => ({
    type: 'user',
    userEntityRef: 'user:default/alice',
    ownershipEntityRefs: ['user:default/alice'],
  }),
};

const boardColumns = [
  testColumn({ id: 'column-1', title: 'In progress' }),
  testColumn({ id: 'column-2', title: 'Todo' }),
];

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const myItems = [
  {
    boardId: 'board-1',
    boardName: 'Roadmap',
    columnTitle: 'In progress',
    item: testItem({
      id: 'item-1',
      title: 'Ship the docs',
      columnId: 'column-1',
      assignees: ['user:default/alice'],
      tags: ['docs', 'urgent'],
      dueDate: '2026-09-04',
    }),
  },
  {
    boardId: 'board-1',
    boardName: 'Roadmap',
    columnTitle: 'Todo',
    item: testItem({
      id: 'item-2',
      title: 'Fix the build',
      columnId: 'column-2',
    }),
  },
  {
    boardId: 'board-2',
    boardName: 'Support',
    columnTitle: 'Triage',
    item: testItem({
      id: 'item-3',
      title: 'Answer the ticket',
      boardId: 'board-2',
      columnId: 'column-1',
    }),
  },
];

function renderList(
  over: {
    items?: unknown[];
    error?: Error;
    access?: BoardPermissionLevel;
    priorities?: ReturnType<typeof testPriorities>;
    api?: Record<string, unknown>;
    storage?: ReturnType<typeof mockApis.storage>;
  } = {},
) {
  const listMyItems = over.error
    ? jest.fn().mockRejectedValue(over.error)
    : jest.fn().mockResolvedValue(over.items ?? myItems);
  const getBoard = jest.fn().mockImplementation(async (boardId: string) => ({
    id: boardId,
    name: boardId === 'board-1' ? 'Roadmap' : 'Support',
    entityRefs: [],
    visibility: 'private',
    createdBy: 'user:default/alice',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    columns: boardColumns,
    priorities: over.priorities ?? [],
    access: over.access ?? 'write',
    favorite: false,
    watching: false,
  }));
  const boardsApi = testBoardsApi({
    listMyItems,
    getBoard,
    ...over.api,
  });
  const storage = over.storage ?? mockApis.storage();
  renderWithProviders(<MyItemsList />, {
    apis: [
      [boardsApiRef, boardsApi],
      [identityApiRef, identityApi],
      [storageApiRef, storage],
    ],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi, storage };
}

/** Switches the listing to another grouping, by its menu label. */
async function groupItemsBy(label: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: /Group by/ }),
  );
  await userEvent.click(await screen.findByRole('option', { name: label }));
}

/** Opens the row's actions menu and waits for it to render. */
async function openRowMenu(title: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: `Actions for ${title}` }),
  );
  await screen.findByRole('menuitem', { name: 'Open details' });
}

describe('MyItemsList', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('groups the assigned items by board', async () => {
    renderList();
    expect(
      await screen.findByRole('button', { name: 'Open board Roadmap' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open board Support' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    expect(
      screen.getByRole('row', { name: /Ship the docs/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /Fix the build/ }),
    ).toBeInTheDocument();
  });

  it('shows the column, tags and due date of an item', async () => {
    renderList();
    // two items sit in a column of that title, one per board
    await waitFor(() =>
      expect(screen.getAllByText('In progress')).toHaveLength(2),
    );
    expect(screen.getByText('docs, urgent')).toBeInTheDocument();
    expect(screen.getByText(/Sep 4/)).toBeInTheDocument();
  });

  it('shows the priority column only when an item has a priority', async () => {
    renderList({
      items: [
        {
          ...myItems[0],
          item: testItem({
            id: 'item-1',
            title: 'Ship the docs',
            columnId: 'column-1',
            assignees: ['user:default/alice'],
            priorityId: 'priority-1',
          }),
          priority: testPriority(),
        },
        myItems[1],
      ],
      priorities: testPriorities(),
    });
    await screen.findByText('Ship the docs');
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toContain('Priority');
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('has no priority column while no item has a priority', async () => {
    renderList();
    await screen.findByText('Ship the docs');
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).not.toContain('Priority');
  });

  it('shows the default columns, Item first', async () => {
    renderList();
    await screen.findByText('Ship the docs');
    // grouped by board renders one table per board; check the first
    expect(
      within(screen.getAllByRole('grid')[0])
        .getAllByRole('columnheader')
        .map(cell => cell.textContent),
    ).toEqual(['Item', 'Status', 'Due', 'Assignees', 'Tags', 'Actions']);
  });

  it('shows and hides columns from the configure menu, stored for the listing', async () => {
    const { storage } = renderList();
    await screen.findByText('Ship the docs');
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Updated' }));
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toContain('Updated');
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: '✓ Tags' }));
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).not.toContain('Tags');
    expect(
      storage.forBucket('boards-table-columns').snapshot<string[]>('my-items')
        .value,
    ).toEqual([
      'title',
      'status',
      'priority',
      'dueDate',
      'assignees',
      'updatedAt',
    ]);
  });

  it('offers the priorities of the item’s own board in the row menu', async () => {
    const { boardsApi } = renderList({ priorities: testPriorities() });
    await openRowMenu('Ship the docs');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Priority' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'critical' }),
    );
    await waitFor(() =>
      expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
        priorityId: 'priority-1',
      }),
    );
  });

  it('falls back to the listing status until the board resolves', async () => {
    renderList({ api: { getBoard: jest.fn(() => new Promise(() => {})) } });
    expect(await screen.findByText('Triage')).toBeInTheDocument();
  });

  it('navigates to the board of a group', async () => {
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open board Support' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-2');
  });

  it('opens the item drawer in place when its row is activated', async () => {
    renderList();
    await userEvent.click(
      await screen.findByRole('row', { name: /Ship the docs/ }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Item Ship the docs' }),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('offers the board item actions plus Open board from the row', async () => {
    renderList();
    await openRowMenu('Ship the docs');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Open details',
      'Copy link',
      'Open board',
      'Move to column',
      'Due date',
      'Assignee',
      'Delete item',
    ]);
  });

  it('opens the item drawer from the row menu', async () => {
    renderList();
    await openRowMenu('Ship the docs');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Open details' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Item Ship the docs' }),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens a read-only drawer on a board the user can only read', async () => {
    renderList({ access: 'read' });
    await openRowMenu('Ship the docs');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Open details' }),
    );
    await screen.findByRole('dialog', { name: 'Item Ship the docs' });
    expect(
      screen.queryByRole('textbox', { name: 'New comment' }),
    ).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('saves a drawer edit and refreshes the listing', async () => {
    const { boardsApi } = renderList();
    await userEvent.click(
      await screen.findByRole('row', { name: /Ship the docs/ }),
    );
    await screen.findByRole('dialog', { name: 'Item Ship the docs' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove due date' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      dueDate: null,
    });
    // the drawer's invalidation reaches the my-items listing too
    await waitFor(() =>
      expect(boardsApi.listMyItems.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('moves an item to another column of its board', async () => {
    const { boardsApi } = renderList();
    await openRowMenu('Ship the docs');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Move to column' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Todo' }),
    );
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-1', {
      columnId: 'column-2',
    });
  });

  it('sets a due date from the row menu', async () => {
    const { boardsApi } = renderList();
    await openRowMenu('Answer the ticket');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Due date' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Today' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-2', 'item-3', {
      dueDate: todayISO(),
    });
  });

  it('unassigns the user from the row menu', async () => {
    const { boardsApi } = renderList();
    await openRowMenu('Ship the docs');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '✓ Me' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      assignees: [],
    });
  });

  it('deletes an item from the row menu', async () => {
    const { boardsApi } = renderList();
    await openRowMenu('Fix the build');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Delete item' }),
    );
    expect(boardsApi.deleteItem).toHaveBeenCalledWith('board-1', 'item-2');
  });

  it('offers navigation only on a board the user cannot write', async () => {
    renderList({ access: 'read' });
    await openRowMenu('Ship the docs');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details', 'Copy link', 'Open board']);
  });

  it('offers navigation only on an externally managed item', async () => {
    renderList({
      items: [
        {
          boardId: 'board-1',
          boardName: 'Roadmap',
          columnTitle: 'In progress',
          item: testItem({
            id: 'item-9',
            title: 'Synced issue',
            externalManager: 'github',
          }),
        },
      ],
    });
    await openRowMenu('Synced issue');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details', 'Copy link', 'Open board']);
  });

  it('reports a failed row action', async () => {
    renderList({
      api: {
        deleteItem: jest.fn().mockRejectedValue(new Error('Not allowed')),
      },
    });
    await openRowMenu('Fix the build');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Delete item' }),
    );
    expect(await screen.findByText('Not allowed')).toBeInTheDocument();
  });

  it('opens the item menu at the pointer on right-click', async () => {
    renderList();
    const row = await screen.findByRole('row', { name: /Answer the ticket/ });
    await userEvent.pointer({ target: row, keys: '[MouseRight]' });
    expect(
      (await screen.findAllByRole('menuitem')).map(entry => entry.textContent),
    ).toEqual([
      'Open details',
      'Copy link',
      'Open board',
      'Move to column',
      'Due date',
      'Assignee',
      'Delete item',
    ]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open board' }));
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-2');
  });

  it('says so when nothing is assigned', async () => {
    renderList({ items: [] });
    expect(
      await screen.findByText('Nothing is assigned to you on any board.'),
    ).toBeInTheDocument();
  });

  it('reports a load failure', async () => {
    renderList({ error: new Error('Backend down') });
    expect(
      await screen.findByText('My items could not be loaded: Backend down'),
    ).toBeInTheDocument();
  });

  it('resolves each row against its own board in a mixed group', async () => {
    renderList({
      api: {
        getBoard: jest.fn().mockImplementation(async (boardId: string) => ({
          id: boardId,
          name: boardId === 'board-1' ? 'Roadmap' : 'Support',
          entityRefs: [],
          visibility: 'private',
          createdBy: 'user:default/alice',
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          columns:
            boardId === 'board-1'
              ? boardColumns
              : [testColumn({ id: 'column-1', title: 'Triage' })],
          access: boardId === 'board-1' ? 'write' : 'read',
          favorite: false,
          watching: false,
        })),
      },
    });
    await groupItemsBy('Not grouped');

    await openRowMenu('Ship the docs');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Move to column' }),
    );
    expect(
      (await screen.findAllByRole('menuitem'))
        .map(entry => entry.textContent)
        .filter(title => title === 'Todo'),
    ).toEqual(['Todo']);
    await userEvent.keyboard('{Escape}{Escape}');

    // the same group, but a board the user may only read
    await openRowMenu('Answer the ticket');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details', 'Copy link', 'Open board']);
  });
});

describe('MyItemsList filtering', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('filters by text and reports how many items match', async () => {
    renderList();
    await screen.findByRole('row', { name: /Ship the docs/ });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search items' }),
      'docs',
    );
    expect(await screen.findByText('1 of 3 items')).toBeInTheDocument();
    expect(
      screen.queryByRole('row', { name: /Fix the build/ }),
    ).not.toBeInTheDocument();
  });

  it('drops a board whose items all filter out', async () => {
    renderList();
    await screen.findByRole('button', { name: 'Open board Support' });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search items' }),
      'docs',
    );
    await screen.findByText('1 of 3 items');
    expect(
      screen.queryByRole('button', { name: 'Open board Support' }),
    ).not.toBeInTheDocument();
  });

  it('requires every selected tag and clears the filters again', async () => {
    renderList();
    await screen.findByRole('row', { name: /Ship the docs/ });
    await userEvent.click(screen.getByRole('button', { name: 'Tags' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'urgent' }),
    );
    expect(await screen.findByText('1 of 3 items')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    expect(
      await screen.findByRole('row', { name: /Fix the build/ }),
    ).toBeInTheDocument();
  });

  it('says when the filters match nothing', async () => {
    renderList();
    await screen.findByRole('row', { name: /Ship the docs/ });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search items' }),
      'nothing matches this',
    );
    expect(
      await screen.findByText('No items match your filters.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Nothing is assigned to you on any board.'),
    ).not.toBeInTheDocument();
  });

  it('offers no assignee filter while one assignee holds everything', async () => {
    renderList();
    await screen.findByRole('row', { name: /Ship the docs/ });
    expect(screen.getByRole('button', { name: 'Tags' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Assignees' }),
    ).not.toBeInTheDocument();
  });

  it('filters by assignee once the items carry more than one', async () => {
    renderList({
      items: [
        {
          boardId: 'board-1',
          boardName: 'Roadmap',
          columnTitle: 'In progress',
          item: testItem({
            id: 'item-1',
            title: 'Ship the docs',
            assignees: ['user:default/alice'],
          }),
        },
        {
          boardId: 'board-1',
          boardName: 'Roadmap',
          columnTitle: 'Todo',
          item: testItem({
            id: 'item-2',
            title: 'Fix the build',
            assignees: ['group:default/team-a'],
          }),
        },
      ],
    });
    await screen.findByRole('row', { name: /Ship the docs/ });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Assignees' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'team-a' }),
    );
    expect(await screen.findByText('1 of 2 items')).toBeInTheDocument();
    expect(
      screen.queryByRole('row', { name: /Ship the docs/ }),
    ).not.toBeInTheDocument();
  });
});

describe('MyItemsList grouping', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('groups by board without a board column by default', async () => {
    renderList();
    await screen.findByRole('button', { name: 'Open board Roadmap' });
    expect(
      screen.queryByRole('columnheader', { name: 'Board' }),
    ).not.toBeInTheDocument();
  });

  it('shows every item in one table with its board when not grouped', async () => {
    renderList();
    await groupItemsBy('Not grouped');
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader', { name: 'Board' })).toHaveLength(
      1,
    );
    expect(screen.getAllByRole('row')).toHaveLength(4); // header plus three
    await userEvent.click(
      screen.getByRole('button', { name: 'Open board Support' }),
    );
    // the board cell opens the board, not the row's item
    expect(mockNavigate.mock.calls).toEqual([['/boards/board-2']]);
  });

  it('groups by due date with the most urgent first', async () => {
    renderList({
      items: [
        {
          boardId: 'board-1',
          boardName: 'Roadmap',
          columnTitle: 'Todo',
          item: testItem({ id: 'item-1', title: 'Undated item' }),
        },
        {
          boardId: 'board-1',
          boardName: 'Roadmap',
          columnTitle: 'Todo',
          item: testItem({
            id: 'item-2',
            title: 'Dated item',
            dueDate: todayISO(),
          }),
        },
      ],
    });
    await groupItemsBy('By due date');
    const headings = screen
      .getAllByRole('grid')
      .map(grid => grid.getAttribute('aria-label'));
    expect(headings).toEqual([
      `My items grouped under ${todayISO()}`,
      'My items grouped under No due date',
    ]);
    // the heading reads like a board's, not like the raw group key
    expect(screen.getAllByText('Due today')).toHaveLength(2); // heading, badge
    expect(screen.queryByText(todayISO())).not.toBeInTheDocument();
    expect(screen.getByText('No due date')).toBeInTheDocument();
  });

  it('groups by tag, listing a multi-tag item under each', async () => {
    renderList();
    await groupItemsBy('By tags');
    expect(
      screen.getAllByRole('grid').map(grid => grid.getAttribute('aria-label')),
    ).toEqual([
      'My items grouped under docs',
      'My items grouped under urgent',
      'My items grouped under Untagged',
    ]);
    expect(screen.getAllByRole('row', { name: /Ship the docs/ })).toHaveLength(
      2,
    );
    expect(screen.getByText('Untagged')).toBeInTheDocument();
  });
});

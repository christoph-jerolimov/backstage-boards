import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { BoardPermissionLevel, todayISO } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { MyItemsList } from './MyItemsPage';
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
    api?: Record<string, unknown>;
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
    access: over.access ?? 'write',
    favorite: false,
    watching: false,
  }));
  const boardsApi = testBoardsApi({
    listMyItems,
    getBoard,
    ...over.api,
  });
  renderWithProviders(<MyItemsList />, {
    apis: [
      [boardsApiRef, boardsApi],
      [identityApiRef, identityApi],
    ],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi };
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
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('docs, urgent')).toBeInTheDocument();
    expect(screen.getByText(/Sep 4/)).toBeInTheDocument();
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

  it('opens an item on its board when its row is activated', async () => {
    renderList();
    await userEvent.click(
      await screen.findByRole('row', { name: /Ship the docs/ }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-1?item=item-1');
  });

  it('offers the board item actions plus Open board from the row', async () => {
    renderList();
    await openRowMenu('Ship the docs');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Open details',
      'Open board',
      'Move to column',
      'Due date',
      'Assignee',
      'Delete item',
    ]);
  });

  it('opens an item from the row menu', async () => {
    renderList();
    await openRowMenu('Ship the docs');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Open details' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-1?item=item-1');
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
    ).toEqual(['Open details', 'Open board']);
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
    ).toEqual(['Open details', 'Open board']);
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
});

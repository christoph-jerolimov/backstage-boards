import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { MyItemsList } from './MyItemsPage';
import { renderWithProviders, testBoardsApi, testItem } from './__testUtils__/testHelpers';

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
      tags: ['docs', 'urgent'],
      dueDate: '2026-09-04',
    }),
  },
  {
    boardId: 'board-1',
    boardName: 'Roadmap',
    columnTitle: 'Todo',
    item: testItem({ id: 'item-2', title: 'Fix the build' }),
  },
  {
    boardId: 'board-2',
    boardName: 'Support',
    columnTitle: 'Triage',
    item: testItem({ id: 'item-3', title: 'Answer the ticket' }),
  },
];

function renderList(over: { items?: unknown[]; error?: Error } = {}) {
  const listMyItems = over.error
    ? jest.fn().mockRejectedValue(over.error)
    : jest.fn().mockResolvedValue(over.items ?? myItems);
  const boardsApi = testBoardsApi({ listMyItems } as any);
  renderWithProviders(<MyItemsList />, {
    apis: [[boardsApiRef, boardsApi]],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi };
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
    expect(
      screen.getByRole('button', { name: 'Open item Ship the docs' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open item Fix the build' }),
    ).toBeInTheDocument();
  });

  it('shows the column, tags and due date of an item', async () => {
    renderList();
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('docs, urgent')).toBeInTheDocument();
    expect(screen.getByText(/Sep 4/)).toBeInTheDocument();
  });

  it('navigates to the board of a group', async () => {
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open board Support' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-2');
  });

  it('opens an item on its board', async () => {
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open item Ship the docs' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-1?item=item-1');
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

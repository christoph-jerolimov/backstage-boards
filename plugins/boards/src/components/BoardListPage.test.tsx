import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { BoardListPage } from './BoardListPage';
import {
  renderWithProviders,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const boards = [
  {
    id: 'board-1',
    name: 'Roadmap',
    favorite: true,
    access: 'admin',
    entityRefs: ['component:default/www'],
  },
  {
    id: 'board-2',
    name: 'Support',
    favorite: false,
    access: 'read',
    entityRefs: [],
  },
];

function renderPage(over: { boardsApi?: any; boards?: unknown[] } = {}) {
  const boardsApi =
    over.boardsApi ??
    testBoardsApi({
      listBoards: jest.fn().mockResolvedValue(over.boards ?? boards),
    } as any);
  renderWithProviders(<BoardListPage />, {
    apis: [[boardsApiRef, boardsApi]],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi };
}

describe('BoardListPage', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('opens on the favorites tab and counts both tabs', async () => {
    renderPage();
    expect(
      await screen.findByRole('tab', { name: 'Favorites (1)' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All (2)' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open board Roadmap' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open board Support' }),
    ).not.toBeInTheDocument();
  });

  it('lists every accessible board on the All tab', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'All (2)' }));
    expect(
      screen.getByRole('button', { name: 'Open board Support' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'www' }),
    ).toBeInTheDocument();
    expect(screen.getByText('read')).toBeInTheDocument();
  });

  it('shows the current user items on the My items tab', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'My items' }));
    expect(
      await screen.findByText('Nothing is assigned to you on any board.'),
    ).toBeInTheDocument();
  });

  it('points at the All tab when nothing is starred', async () => {
    renderPage({ boards: [{ ...boards[1] }] });
    expect(
      await screen.findByText(
        'No favorite boards yet — star a board in the All tab.',
      ),
    ).toBeInTheDocument();
  });

  it('invites the user to create the first board', async () => {
    renderPage({ boards: [] });
    await userEvent.click(await screen.findByRole('tab', { name: 'All (0)' }));
    expect(
      screen.getByText('No boards are accessible to you yet. Create one!'),
    ).toBeInTheDocument();
  });

  it('toggles a favorite and reloads the list', async () => {
    const { boardsApi } = renderPage();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Remove Roadmap from favorites',
      }),
    );
    expect(boardsApi.setFavorite).toHaveBeenCalledWith('board-1', false);
    await waitFor(() => expect(boardsApi.listBoards).toHaveBeenCalledTimes(2));
  });

  it('opens a board', async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open board Roadmap' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('board-1');
  });

  it('navigates to the My items page', async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'My items', hidden: false }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('my-items');
  });

  it('creates a board and opens it', async () => {
    const boardsApi = testBoardsApi({
      listBoards: jest.fn().mockResolvedValue(boards),
      createBoard: jest.fn().mockResolvedValue({ id: 'board-3' }),
    } as any);
    renderPage({ boardsApi });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create board' }),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Board name' }),
      'Team Alpha{Enter}',
    );
    expect(boardsApi.createBoard).toHaveBeenCalledWith({ name: 'Team Alpha' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('board-3'));
  });

  it('does not create a board without a name', async () => {
    const { boardsApi } = renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create board' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create' }),
    );
    expect(boardsApi.createBoard).not.toHaveBeenCalled();
  });

  it('reports why creating failed', async () => {
    const boardsApi = testBoardsApi({
      listBoards: jest.fn().mockResolvedValue(boards),
      createBoard: jest.fn().mockRejectedValue(new Error('Name taken')),
    } as any);
    renderPage({ boardsApi });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create board' }),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Board name' }),
      'Roadmap{Enter}',
    );
    expect(
      await screen.findByText('Could not create board: Name taken'),
    ).toBeInTheDocument();
  });
});

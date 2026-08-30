import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { BoardsContent } from './BoardsWidget';
import {
  renderWithProviders,
  testBoardListEntry,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const boards = [
  testBoardListEntry({
    id: 'board-1',
    name: 'Roadmap',
    favorite: true,
    statusCounts: [
      { columnId: 'c1', title: 'Todo', color: 'blue', count: 3 },
      { columnId: 'c2', title: 'In progress', count: 1 },
      { columnId: 'c3', title: 'Done', count: 0 },
    ],
  }),
  testBoardListEntry({ id: 'board-2', name: 'Support' }),
];

function renderWidget(
  props: Parameters<typeof BoardsContent>[0] = {},
  over: { boards?: unknown[]; error?: Error } = {},
) {
  const listBoards = over.error
    ? jest.fn().mockRejectedValue(over.error)
    : jest.fn().mockResolvedValue({
        boards: over.boards ?? boards,
        total: (over.boards ?? boards).length,
      });
  const boardsApi = testBoardsApi({ listBoards });
  renderWithProviders(<BoardsContent {...props} />, {
    apis: [[boardsApiRef, boardsApi]],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi };
}

describe('BoardsContent', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders with no props at all, using the documented defaults', async () => {
    // an unconfigured card arrives without any settings prop
    const { boardsApi } = renderWidget();
    expect(
      await screen.findByRole('button', { name: 'Open board Roadmap' }),
    ).toBeInTheDocument();
    // default scope "favorites", default showCounts on
    expect(boardsApi.listBoards).toHaveBeenCalledWith({
      favoritesOnly: true,
      withCounts: true,
    });
    expect(screen.getByText(/Todo 3/)).toBeInTheDocument();
  });

  it('shows a loading state while the boards are in flight', () => {
    renderWidget();
    expect(screen.getByText('Loading boards…')).toBeInTheDocument();
  });

  it('reports a failure inside the card', async () => {
    renderWidget({}, { error: new Error('backend is down') });
    expect(
      await screen.findByText(/Boards could not be loaded: backend is down/),
    ).toBeInTheDocument();
  });

  it('asks for every accessible board in the "all" scope', async () => {
    const { boardsApi } = renderWidget({ scope: 'all' });
    expect(
      await screen.findByRole('button', { name: 'Open board Support' }),
    ).toBeInTheDocument();
    expect(boardsApi.listBoards).toHaveBeenCalledWith({
      favoritesOnly: false,
      withCounts: true,
    });
  });

  it('neither requests nor shows counts when the setting is off', async () => {
    const { boardsApi } = renderWidget({ showCounts: false });
    await screen.findByRole('button', { name: 'Open board Roadmap' });
    expect(boardsApi.listBoards).toHaveBeenCalledWith({
      favoritesOnly: true,
      withCounts: false,
    });
    expect(screen.queryByText(/Todo 3/)).not.toBeInTheDocument();
  });

  it('shows a count per status, including a zero', async () => {
    renderWidget({ showCounts: true });
    expect(await screen.findByText(/Todo 3/)).toBeInTheDocument();
    expect(screen.getByText(/In progress 1/)).toBeInTheDocument();
    expect(screen.getByText(/Done 0/)).toBeInTheDocument();
  });

  it('distinguishes the empty favorites message from the empty all message', async () => {
    renderWidget({ scope: 'favorites' }, { boards: [] });
    expect(
      await screen.findByText('You have not favorited any board yet.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open the boards page' }),
    ).toBeInTheDocument();
  });

  it('says when no board is accessible at all', async () => {
    renderWidget({ scope: 'all' }, { boards: [] });
    expect(
      await screen.findByText('You cannot access any board yet.'),
    ).toBeInTheDocument();
  });

  it('opens a board', async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open board Support' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-2');
  });
});

import { screen } from '@testing-library/react';
import { boardsApiRef } from '../api';
import { boardsQueryClient } from '../queries';
import { rootRouteRef } from '../routes';
import { BoardsPage } from './BoardsPage';
import { renderWithProviders, testBoardsApi } from './__testUtils__/testHelpers';

describe('BoardsPage', () => {
  it('routes the index path to the board list', async () => {
    boardsQueryClient.clear();
    const boardsApi = testBoardsApi({
      listBoards: jest.fn().mockResolvedValue([]),
    } as any);
    renderWithProviders(<BoardsPage />, {
      apis: [[boardsApiRef, boardsApi]],
      mountedRoutes: { '/boards': rootRouteRef },
    });
    expect(
      await screen.findByRole('heading', { name: 'Boards' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: 'Favorites (0)' }),
    ).toBeInTheDocument();
  });
});

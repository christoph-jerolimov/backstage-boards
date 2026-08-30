import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BoardFilterOptions,
  BoardListEntry,
} from '@internal/plugin-boards-common';
import { boardsApiRef, BoardsApi, BoardListQuery } from '../api';
import { rootRouteRef } from '../routes';
import { BoardListPage } from './BoardListPage';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
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

const boards: BoardListEntry[] = [
  testBoardListEntry({
    id: 'board-1',
    name: 'Roadmap',
    favorite: true,
    access: 'admin',
    entityRefs: ['component:default/www'],
  }),
  testBoardListEntry({
    id: 'board-2',
    name: 'Support',
    favorite: false,
    access: 'read',
  }),
];

/**
 * A listing double that actually filters and pages, so the page's own
 * behaviour — which tab asks for what, where paging lands — is what the
 * tests observe rather than a fixed answer.
 */
function listBoardsDouble(all: BoardListEntry[]) {
  return jest.fn(async (query: BoardListQuery = {}) => {
    const search = query.search?.trim().toLocaleLowerCase('en-US');
    const matching = all.filter(board => {
      if (query.favoritesOnly && !board.favorite) return false;
      if (search && !board.name.toLocaleLowerCase('en-US').includes(search))
        return false;
      if (query.entityRef && !board.entityRefs.includes(query.entityRef))
        return false;
      if (query.createdBy && board.createdBy !== query.createdBy) return false;
      return true;
    });
    const offset = query.offset ?? 0;
    const limit = query.limit ?? matching.length;
    return {
      boards: matching.slice(offset, offset + limit),
      total: matching.length,
      limit,
      offset,
    };
  });
}

function renderPage(
  over: {
    boardsApi?: jest.Mocked<BoardsApi>;
    boards?: BoardListEntry[];
    filterOptions?: Partial<BoardFilterOptions>;
  } = {},
) {
  const all = over.boards ?? boards;
  const boardsApi =
    over.boardsApi ??
    testBoardsApi({
      listBoards: listBoardsDouble(all),
      listFilterOptions: jest.fn().mockResolvedValue({
        total: all.length,
        favorites: all.filter(board => board.favorite).length,
        entityRefs: [...new Set(all.flatMap(board => board.entityRefs))],
        creators: [...new Set(all.map(board => board.createdBy))],
        ...over.filterOptions,
      }),
    });
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
    expect(screen.getByRole('row', { name: /Roadmap/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('row', { name: /Support/ }),
    ).not.toBeInTheDocument();
  });

  it('lists every accessible board on the All tab', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'All (2)' }));
    expect(screen.getByRole('row', { name: /Support/ })).toBeInTheDocument();
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
      await screen.findByText('No favorite boards yet'),
    ).toBeInTheDocument();
  });

  it('invites the user to create the first board', async () => {
    renderPage({ boards: [] });
    await userEvent.click(await screen.findByRole('tab', { name: 'All (0)' }));
    expect(
      screen.getByText('No boards are accessible to you yet'),
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
    // both tabs are stale: the star moves the board between them
    await waitFor(() => expect(boardsApi.listBoards).toHaveBeenCalledTimes(4));
  });

  it('opens a board when its row is activated', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('row', { name: /Roadmap/ }));
    expect(mockNavigate).toHaveBeenCalledWith('board-1');
  });

  it('keeps My items on a tab rather than a header button', async () => {
    renderPage();
    expect(
      await screen.findByRole('tab', { name: 'My items' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'My items' }),
    ).not.toBeInTheDocument();
  });

  it('offers the board menu from the row', async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for Roadmap' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Open board' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('board-1');
  });

  it('toggles the favorite from the row menu', async () => {
    const { boardsApi } = renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for Roadmap' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove from favorites' }),
    );
    expect(boardsApi.setFavorite).toHaveBeenCalledWith('board-1', false);
  });

  it('opens the board menu at the pointer on right-click', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: /Roadmap/ });
    await userEvent.pointer({ target: row, keys: '[MouseRight]' });
    expect(
      await screen.findByRole('menuitem', { name: 'Open board' }),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('creates a board and opens it', async () => {
    const boardsApi = testBoardsApi({
      listBoards: listBoardsDouble(boards),
      createBoard: jest.fn().mockResolvedValue({ id: 'board-3' }),
    });
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
      listBoards: listBoardsDouble(boards),
      createBoard: jest.fn().mockRejectedValue(new Error('Name taken')),
    });
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

  describe('filter bar and pagination', () => {
    const many: BoardListEntry[] = [
      testBoardListEntry({
        id: 'board-1',
        name: 'Payments',
        entityRefs: ['system:default/payments'],
        createdBy: 'user:default/alice',
      }),
      testBoardListEntry({
        id: 'board-2',
        name: 'Shipping',
        createdBy: 'user:default/bob',
      }),
      testBoardListEntry({ id: 'board-3', name: 'Support' }),
    ];

    async function openAllTab() {
      await userEvent.click(
        await screen.findByRole('tab', { name: `All (${many.length})` }),
      );
    }

    it('narrows the listing by the search field', async () => {
      const { boardsApi } = renderPage({ boards: many });
      await openAllTab();
      await userEvent.type(
        await screen.findByRole('searchbox', { name: 'Search boards' }),
        'ship',
      );
      await waitFor(() =>
        expect(boardsApi.listBoards).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'ship' }),
        ),
      );
      expect(
        await screen.findByRole('row', { name: /Shipping/ }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.queryByRole('row', { name: /Payments/ }),
        ).not.toBeInTheDocument(),
      );
    });

    it('keeps the All count on every readable board while filtering', async () => {
      renderPage({ boards: many });
      await openAllTab();
      await userEvent.type(
        await screen.findByRole('searchbox', { name: 'Search boards' }),
        'ship',
      );
      await screen.findByText('1 of 3 boards');
      // the tab counts what the user can reach, not what survives the filter
      expect(screen.getByRole('tab', { name: 'All (3)' })).toBeInTheDocument();
    });

    it('offers only the entities and creators the listing reported', async () => {
      renderPage({ boards: many });
      await openAllTab();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Entity' }),
      );
      expect(
        await screen.findByRole('menuitem', { name: /payments/ }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('menuitem').map(item => item.textContent),
      ).toEqual(['✓ All entities', 'payments']);
    });

    it('filters by creator and replaces the selection rather than adding to it', async () => {
      const { boardsApi } = renderPage({ boards: many });
      await openAllTab();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Created by' }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'bob' }),
      );
      await waitFor(() =>
        expect(boardsApi.listBoards).toHaveBeenCalledWith(
          expect.objectContaining({ createdBy: 'user:default/bob' }),
        ),
      );

      await userEvent.click(
        await screen.findByRole('button', { name: 'Created by: bob' }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'alice' }),
      );
      await waitFor(() =>
        expect(boardsApi.listBoards).toHaveBeenCalledWith(
          expect.objectContaining({ createdBy: 'user:default/alice' }),
        ),
      );
      expect(boardsApi.listBoards).not.toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: ['user:default/bob', 'user:default/alice'],
        }),
      );
    });

    it('says nothing matched, and clears back to the full list', async () => {
      renderPage({ boards: many });
      await openAllTab();
      await userEvent.type(
        await screen.findByRole('searchbox', { name: 'Search boards' }),
        'nothing here',
      );
      expect(
        await screen.findByText('No boards match your filters'),
      ).toBeInTheDocument();
      // and not the message for a user who has no boards at all
      expect(
        screen.queryByText('No boards are accessible to you yet'),
      ).not.toBeInTheDocument();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Clear filters' }),
      );
      expect(
        await screen.findByRole('row', { name: /Payments/ }),
      ).toBeInTheDocument();
    });

    it('pages through the listing and reports the range', async () => {
      const { boardsApi } = renderPage({ boards: many });
      await openAllTab();
      await userEvent.click(
        await screen.findByRole('button', { name: /Page size/ }),
      );
      await userEvent.click(
        await screen.findByRole('option', { name: '10 per page' }),
      );
      expect(await screen.findByText('1–3 of 3 boards')).toBeInTheDocument();
      // one page holds everything, so there is nowhere to step
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
      await waitFor(() =>
        expect(boardsApi.listBoards).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 10, offset: 0 }),
        ),
      );
    });

    /** Enough boards to page, few enough to keep the render cheap. */
    const dozen = Array.from({ length: 12 }, (_, index) =>
      testBoardListEntry({
        id: `board-${index}`,
        name: `Board ${String(index).padStart(2, '0')}`,
      }),
    );

    /** Shrinks the page so twelve boards span two of them. */
    async function choosePageSizeOfTen() {
      await userEvent.click(
        await screen.findByRole('button', { name: /Page size/ }),
      );
      await userEvent.click(
        await screen.findByRole('option', { name: '10 per page' }),
      );
    }

    it('steps to the next page and back', async () => {
      renderPage({ boards: dozen });
      await userEvent.click(
        await screen.findByRole('tab', { name: 'All (12)' }),
      );
      await choosePageSizeOfTen();
      expect(await screen.findByText('1–10 of 12 boards')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(await screen.findByText('11–12 of 12 boards')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(await screen.findByText('1–10 of 12 boards')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    });

    it('returns to the first page when a filter changes', async () => {
      renderPage({ boards: dozen });
      await userEvent.click(
        await screen.findByRole('tab', { name: 'All (12)' }),
      );
      await choosePageSizeOfTen();
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await screen.findByText('11–12 of 12 boards');

      // the second page would be empty for this search, so paging has to
      // fall back to the first rather than leave the user staring at it
      await userEvent.type(
        screen.getByRole('searchbox', { name: 'Search boards' }),
        'Board 0',
      );
      expect(await screen.findByText(/^1–/)).toBeInTheDocument();
    });

    it('never asks the catalog for a list of users or entities', async () => {
      const catalogApi = {
        getEntitiesByRefs: jest.fn(
          async (request: { entityRefs: string[] }) => ({
            items: request.entityRefs.map(() => undefined),
          }),
        ),
        getEntities: jest.fn(async () => ({ items: [] })),
      };
      const boardsApi = testBoardsApi({
        listBoards: listBoardsDouble(many),
        listFilterOptions: jest.fn().mockResolvedValue({
          total: many.length,
          favorites: 0,
          entityRefs: ['system:default/payments'],
          creators: ['user:default/alice', 'user:default/bob'],
        }),
      });
      renderWithProviders(<BoardListPage />, {
        apis: [
          [boardsApiRef, boardsApi],
          [catalogApiRef, catalogApi],
        ],
        mountedRoutes: { '/boards': rootRouteRef },
      });
      await userEvent.click(
        await screen.findByRole('tab', { name: `All (${many.length})` }),
      );
      await userEvent.click(
        await screen.findByRole('button', { name: 'Created by' }),
      );
      await screen.findByRole('menuitem', { name: /alice/ });

      // the options come from the boards the user can read; the catalog is
      // only ever asked to put a name on a ref it was already handed
      expect(catalogApi.getEntities).not.toHaveBeenCalled();
      expect(boardsApi.listFilterOptions).toHaveBeenCalled();
    });
  });

  describe('favorites tab filter bar', () => {
    /** Two favorites and an unstarred board that matches the search. */
    const mixed: BoardListEntry[] = [
      testBoardListEntry({ id: 'board-1', name: 'Roadmap', favorite: true }),
      testBoardListEntry({ id: 'board-2', name: 'Reviews', favorite: true }),
      testBoardListEntry({ id: 'board-3', name: 'Roadwork', favorite: false }),
    ];

    it('filters within the favorites, never beyond them', async () => {
      const { boardsApi } = renderPage({ boards: mixed });
      await screen.findByRole('row', { name: /Reviews/ });
      await userEvent.type(
        await screen.findByRole('searchbox', { name: 'Search boards' }),
        'road',
      );
      await waitFor(() =>
        expect(boardsApi.listBoards).toHaveBeenCalledWith(
          expect.objectContaining({ favoritesOnly: true, search: 'road' }),
        ),
      );
      expect(
        await screen.findByRole('row', { name: /Roadmap/ }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.queryByRole('row', { name: /Reviews/ }),
        ).not.toBeInTheDocument(),
      );
      // the unstarred board stays absent however well it matches
      expect(
        screen.queryByRole('row', { name: /Roadwork/ }),
      ).not.toBeInTheDocument();
      // the tab counts all favorites while the match count narrows
      expect(await screen.findByText('1 of 2 boards')).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'Favorites (2)' }),
      ).toBeInTheDocument();
    });

    it('says no favorites matched, apart from having none at all', async () => {
      renderPage({ boards: mixed });
      await userEvent.type(
        await screen.findByRole('searchbox', { name: 'Search boards' }),
        'nothing here',
      );
      expect(
        await screen.findByText('No favorite boards match your filters'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/No favorite boards yet/),
      ).not.toBeInTheDocument();
    });

    it("keeps each tab's filters to itself", async () => {
      renderPage({ boards: mixed });
      await userEvent.type(
        await screen.findByRole('searchbox', { name: 'Search boards' }),
        'road',
      );
      await screen.findByText('1 of 2 boards');

      // the All tab is unaffected: empty search field, full listing
      await userEvent.click(screen.getByRole('tab', { name: 'All (3)' }));
      expect(
        await screen.findByRole('row', { name: /Reviews/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('searchbox', { name: 'Search boards' }),
      ).toHaveValue('');

      // and the favorites tab still holds its filter on return
      await userEvent.click(screen.getByRole('tab', { name: 'Favorites (2)' }));
      expect(
        screen.getByRole('searchbox', { name: 'Search boards' }),
      ).toHaveValue('road');
      expect(
        await screen.findByRole('row', { name: /Roadmap/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('row', { name: /Reviews/ }),
      ).not.toBeInTheDocument();
    });

    it('refreshes the favorites count when a star is toggled', async () => {
      const { boardsApi } = renderPage({ boards: mixed });
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Remove Roadmap from favorites',
        }),
      );
      // the label reads the filter options, so they are refetched
      await waitFor(() =>
        expect(
          boardsApi.listFilterOptions.mock.calls.length,
        ).toBeGreaterThanOrEqual(2),
      );
    });
  });
});

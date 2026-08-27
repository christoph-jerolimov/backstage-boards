import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { boardsApiRef } from '../api';
import { boardsQueryClient } from '../queries';
import { rootRouteRef } from '../routes';
import { EntityBoardsContent } from './EntityBoardsContent';
import {
  renderWithProviders,
  testBoardsApi,
  testColumn,
} from './__testUtils__/testHelpers';

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({
    entity: {
      kind: 'Component',
      metadata: { namespace: 'default', name: 'www' },
    },
  }),
}));

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

function board(id: string, name: string) {
  return {
    id,
    name,
    access: 'admin',
    favorite: false,
    watching: false,
    visibility: 'private',
    entityRefs: ['component:default/www'],
    columns: [testColumn({ id: `${id}-column`, title: 'Todo' })],
  };
}

function renderTab(assigned: ReturnType<typeof board>[]) {
  // the component brings its own module-level query client
  boardsQueryClient.clear();
  const boardsApi = testBoardsApi({
    listBoards: jest.fn().mockResolvedValue(assigned),
    getBoard: jest
      .fn()
      .mockImplementation(async (id: string) =>
        assigned.find(entry => entry.id === id),
      ),
    listItems: jest.fn().mockResolvedValue([]),
  } as any);
  renderWithProviders(<EntityBoardsContent />, {
    apis: [
      [boardsApiRef, boardsApi],
      [identityApiRef, identityApi],
      [catalogApiRef, catalogApi],
    ],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi };
}

describe('EntityBoardsContent', () => {
  it('asks only for the boards of the current entity', async () => {
    const { boardsApi } = renderTab([board('board-1', 'Roadmap')]);
    expect(boardsApi.listBoards).toHaveBeenCalledWith({
      entityRef: 'component:default/www',
    });
  });

  it('names the access caveat when no board is readable', async () => {
    renderTab([]);
    expect(
      await screen.findByText(
        'No boards are assigned to this entity that you can access.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a single board inline, without tabs', async () => {
    renderTab([board('board-1', 'Roadmap')]);
    expect(
      await screen.findByRole('heading', { name: 'Roadmap' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('puts several boards behind tabs', async () => {
    renderTab([board('board-1', 'Roadmap'), board('board-2', 'Support')]);
    expect(await screen.findByRole('tab', { name: 'Roadmap' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Support' }));
    expect(
      await screen.findByRole('heading', { name: 'Support' }),
    ).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { boardsApiRef } from '../api';
import { RequireBoardsUse } from './RequireBoardsUse';
import { BoardListPage } from './BoardListPage';
import { EntityBoardsContent } from './EntityBoardsContent';
import { BoardsContent } from './BoardsWidget';
import { BoardsWidgetProvider } from './widgetCommon';
import {
  renderWithProviders,
  testBoardsApi,
  testPermissionApi,
} from './__testUtils__/testHelpers';

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'www', namespace: 'default' },
};

describe('RequireBoardsUse', () => {
  it('renders children when boards.use is allowed', async () => {
    renderWithProviders(
      <RequireBoardsUse fallback={<div>denied</div>}>
        <div>content</div>
      </RequireBoardsUse>,
    );
    await screen.findByText('content');
    expect(screen.queryByText('denied')).toBeNull();
  });

  it('renders the fallback when boards.use is denied', async () => {
    renderWithProviders(
      <RequireBoardsUse fallback={<div>denied</div>}>
        <div>content</div>
      </RequireBoardsUse>,
      {
        apis: [
          [
            permissionApiRef,
            testPermissionApi({ 'boards.use': AuthorizeResult.DENY }),
          ],
        ],
      },
    );
    await screen.findByText('denied');
    expect(screen.queryByText('content')).toBeNull();
  });

  it('fails open when the permission api errors', async () => {
    renderWithProviders(
      <RequireBoardsUse fallback={<div>denied</div>}>
        <div>content</div>
      </RequireBoardsUse>,
      {
        apis: [
          [
            permissionApiRef,
            {
              authorize: async () => {
                throw new Error('permission backend unreachable');
              },
            },
          ],
        ],
      },
    );
    await screen.findByText('content');
  });
});

describe('create affordances', () => {
  it('hides the create-board button without boards.new.create', async () => {
    const boardsApi = testBoardsApi();
    renderWithProviders(<BoardListPage />, {
      apis: [
        [boardsApiRef, boardsApi],
        [
          permissionApiRef,
          testPermissionApi({ 'boards.new.create': AuthorizeResult.DENY }),
        ],
      ],
    });
    // the list itself still renders for the user
    await screen.findByRole('heading', { name: 'Boards' });
    await waitFor(() => expect(boardsApi.listBoards).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Create board' })).toBeNull();
  });

  it('shows the create-board button when allowed', async () => {
    renderWithProviders(<BoardListPage />, {
      apis: [[boardsApiRef, testBoardsApi()]],
    });
    await screen.findByRole('button', { name: 'Create board' });
  });
});

describe('gated surfaces without boards.use', () => {
  const denyUse = () =>
    testPermissionApi({ 'boards.use': AuthorizeResult.DENY });

  it('entity tab shows the restricted state and calls no boards api', async () => {
    const boardsApi = testBoardsApi();
    renderWithProviders(
      <EntityProvider entity={entity}>
        <EntityBoardsContent />
      </EntityProvider>,
      {
        apis: [
          [boardsApiRef, boardsApi],
          [permissionApiRef, denyUse()],
        ],
      },
    );
    await screen.findByText('You do not have access to boards.');
    expect(boardsApi.listBoards).not.toHaveBeenCalled();
  });

  it('home page widget renders nothing and calls no boards api', async () => {
    const boardsApi = testBoardsApi();
    const rendered = renderWithProviders(
      <BoardsWidgetProvider>
        <BoardsContent />
      </BoardsWidgetProvider>,
      {
        apis: [
          [boardsApiRef, boardsApi],
          [permissionApiRef, denyUse()],
        ],
      },
    );
    // the decision resolves in a microtask; give it a tick to land
    await waitFor(() => expect(rendered.container.textContent).toBe(''));
    expect(boardsApi.listBoards).not.toHaveBeenCalled();
  });
});

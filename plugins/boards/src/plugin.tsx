import { RiKanbanView } from '@remixicon/react';
import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { boardsApiRef, BoardsClient } from './api';
import { rootRouteRef } from './routes';

const boardsApi = ApiBlueprint.make({
  params: define =>
    define({
      api: boardsApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new BoardsClient({ discoveryApi, fetchApi }),
    }),
});

const boardsPage = PageBlueprint.make({
  params: {
    path: '/boards',
    title: 'Boards',
    icon: <RiKanbanView size={20} />,
    routeRef: rootRouteRef,
    loader: () => import('./components/BoardsPage').then(m => <m.BoardsPage />),
  },
});

const entityBoardsContent = EntityContentBlueprint.make({
  name: 'entity',
  params: {
    path: 'boards',
    title: 'Boards',
    loader: () =>
      import('./components/EntityBoardsContent').then(m => (
        <m.EntityBoardsContent />
      )),
  },
});

/**
 * The boards frontend plugin (new frontend system only).
 *
 * @public
 */
export const boardsPlugin = createFrontendPlugin({
  pluginId: 'boards',
  extensions: [boardsApi, boardsPage, entityBoardsContent],
  routes: {
    root: rootRouteRef,
  },
});

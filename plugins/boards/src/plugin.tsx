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

function BoardsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1" fill="currentColor" />
      <rect x="10" y="4" width="5" height="10" rx="1" fill="currentColor" />
      <rect x="17" y="4" width="5" height="13" rx="1" fill="currentColor" />
    </svg>
  );
}

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
    icon: <BoardsIcon />,
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/BoardsPage').then(m => <m.BoardsPage />),
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

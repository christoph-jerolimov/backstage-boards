import { RiKanbanView } from '@remixicon/react';
import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { HomePageWidgetBlueprint } from '@backstage/plugin-home-react/alpha';
import {
  BOARDS_ENTITY_IS_REFERENCED_LABEL_PATH,
  BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE,
} from '@internal/plugin-boards-common';
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
    // Only entities a board references carry this label; the boards catalog
    // module (`@internal/plugin-catalog-backend-module-boards`) derives it.
    // Overridable per deployment through the extension's `filter` config.
    filter: {
      [BOARDS_ENTITY_IS_REFERENCED_LABEL_PATH]:
        BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE,
    },
    loader: () =>
      import('./components/EntityBoardsContent').then(m => (
        <m.EntityBoardsContent />
      )),
  },
});

/**
 * Home page cards. The grid persists each placed card's settings and
 * spreads them onto the widget as props, so every schema property below
 * is a prop of the content component. Stored settings start out empty, so
 * the `default`s here are documentation — the components default their
 * own props.
 */
const assignedItemsWidget = HomePageWidgetBlueprint.make({
  name: 'assigned-items',
  params: {
    name: 'BoardsAssignedItems',
    title: 'Assigned items',
    description:
      'Items assigned to you across every board you can read, filtered and grouped as you like',
    layout: {
      width: { minColumns: 3, defaultColumns: 4, maxColumns: 12 },
      height: { minRows: 3, defaultRows: 6 },
    },
    settings: {
      schema: {
        title: 'Assigned items',
        type: 'object',
        properties: {
          scope: {
            title: 'Show',
            type: 'string',
            default: 'all',
            oneOf: [
              { const: 'all', title: 'All assigned items' },
              { const: 'due', title: 'Only items due today or overdue' },
            ],
          },
          groupBy: {
            title: 'Group by',
            type: 'string',
            default: 'board',
            oneOf: [
              { const: 'board', title: 'Board' },
              { const: 'status', title: 'Status' },
              { const: 'dueDate', title: 'Due date' },
            ],
          },
        },
      },
      uiSchema: {
        scope: { 'ui:widget': 'radio' },
        groupBy: { 'ui:widget': 'radio' },
      },
    },
    components: () =>
      import('./components/AssignedItemsWidget').then(m => ({
        Content: m.AssignedItemsContent,
        ContextProvider: m.BoardsWidgetProvider,
      })),
  },
});

const boardsWidget = HomePageWidgetBlueprint.make({
  name: 'boards',
  params: {
    name: 'BoardsList',
    title: 'Boards',
    description:
      'The boards you can reach, optionally with the number of items per status',
    layout: {
      width: { minColumns: 3, defaultColumns: 4, maxColumns: 12 },
      height: { minRows: 3, defaultRows: 6 },
    },
    settings: {
      schema: {
        title: 'Boards',
        type: 'object',
        properties: {
          scope: {
            title: 'Show',
            type: 'string',
            default: 'favorites',
            oneOf: [
              { const: 'favorites', title: 'Favorited boards' },
              { const: 'all', title: 'All accessible boards' },
            ],
          },
          showCounts: {
            title: 'Show the number of items per status',
            type: 'boolean',
            default: true,
          },
        },
      },
      uiSchema: {
        scope: { 'ui:widget': 'radio' },
      },
    },
    components: () =>
      import('./components/BoardsWidget').then(m => ({
        Content: m.BoardsContent,
        ContextProvider: m.BoardsWidgetProvider,
      })),
  },
});

/**
 * The boards frontend plugin (new frontend system only).
 *
 * @public
 */
export const boardsPlugin = createFrontendPlugin({
  pluginId: 'boards',
  extensions: [
    boardsApi,
    boardsPage,
    entityBoardsContent,
    assignedItemsWidget,
    boardsWidget,
  ],
  routes: {
    root: rootRouteRef,
  },
});

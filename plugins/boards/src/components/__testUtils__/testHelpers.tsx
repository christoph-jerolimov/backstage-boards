import { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import {
  AuthorizeResult,
  EvaluatePermissionRequest,
} from '@backstage/plugin-permission-common';
import {
  BoardColumn,
  BoardItem,
  BoardListEntry,
  BoardPriority,
  BoardWithContext,
  MyBoardItem,
} from '@internal/plugin-boards-common';
import { BoardsApi } from '../../api';
import { BoardActions } from '../BoardView';
import { BulkActions } from '../useBoardActions';

/**
 * Renders a component inside a test app (routing and app context, which
 * catalog entity links need) with a fresh query client and any stubbed
 * APIs.
 */
/** The options `renderInTestApp` accepts, so ours stay in step with it. */
type TestAppOptions = NonNullable<Parameters<typeof renderInTestApp>[1]>;

/**
 * A catalog that resolves nothing, so components that look entity refs up
 * render their fallbacks. The real app always has this API; tests that
 * care about the answers pass their own.
 */
export const emptyCatalogApi = {
  getEntitiesByRefs: async (request: { entityRefs: string[] }) => ({
    items: request.entityRefs.map(() => undefined),
  }),
  getEntities: async () => ({ items: [] }),
};

/**
 * A permission api answering from the given map by permission name, with
 * missing entries allowed — the framework's answer under the allow-all
 * policy or with permissions disabled. Built with no argument it
 * reproduces the plugin's default environment, and it is the default
 * permission api of {@link renderWithProviders}.
 */
export function testPermissionApi(
  decisions: Record<string, AuthorizeResult.ALLOW | AuthorizeResult.DENY> = {},
) {
  return {
    authorize: async (request: EvaluatePermissionRequest) => ({
      result: decisions[request.permission.name] ?? AuthorizeResult.ALLOW,
    }),
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Pick<TestAppOptions, 'apis' | 'mountedRoutes'>,
) {
  let apis = options?.apis ?? [];
  if (!apis.some(([ref]) => ref === catalogApiRef)) {
    apis = [...apis, [catalogApiRef, emptyCatalogApi] as (typeof apis)[number]];
  }
  // permission gates resolve to ALLOW unless a test decides otherwise
  if (!apis.some(([ref]) => ref === permissionApiRef)) {
    apis = [
      ...apis,
      [permissionApiRef, testPermissionApi()] as (typeof apis)[number],
    ];
  }
  const withCatalog = apis;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderInTestApp(
    // a fresh SWR cache per render: `usePermission` caches its decisions in
    // SWR's global cache, which would otherwise leak between tests
    <SWRConfig value={{ provider: () => new Map() }}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SWRConfig>,
    {
      apis: withCatalog,
      mountedRoutes: {
        // catalog entity links resolve through this route
        '/catalog/:namespace/:kind/:name': entityRouteRef,
        ...options?.mountedRoutes,
      },
    },
  );
}

/** A board item with sensible defaults for tests. */
export function testItem(over: Partial<BoardItem> = {}): BoardItem {
  return {
    id: 'item-1',
    boardId: 'board-1',
    columnId: 'column-1',
    position: 1000,
    title: 'Test item',
    createdBy: 'user:default/alice',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedBy: 'user:default/alice',
    updatedAt: '2026-08-02T10:00:00.000Z',
    descriptionVersionCount: 0,
    assignees: [],
    tags: [],
    checklist: [],
    ...over,
  };
}

/** A my-items entry (item plus its board/column context) for tests. */
export function testMyItem(
  over: Omit<Partial<MyBoardItem>, 'item'> & { item?: Partial<BoardItem> } = {},
): MyBoardItem {
  const { item, ...rest } = over;
  return {
    item: testItem(item),
    boardId: 'board-1',
    boardName: 'Board One',
    columnTitle: 'Todo',
    ...rest,
  };
}

/** A board list entry with sensible defaults for tests. */
export function testBoardListEntry(
  over: Partial<BoardListEntry> = {},
): BoardListEntry {
  return {
    id: 'board-1',
    name: 'Board One',
    entityRefs: [],
    visibility: 'private',
    createdBy: 'user:default/alice',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-02T10:00:00.000Z',
    access: 'admin',
    favorite: false,
    ...over,
  };
}

/** A board with its per-user context, with sensible defaults for tests. */
export function testBoard(
  over: Partial<BoardWithContext> = {},
): BoardWithContext {
  return {
    id: 'board-1',
    name: 'Roadmap',
    entityRefs: [],
    visibility: 'private',
    createdBy: 'user:default/alice',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-02T10:00:00.000Z',
    columns: [],
    priorities: [],
    access: 'admin',
    favorite: false,
    watching: false,
    ...over,
  };
}

export function testColumn(over: Partial<BoardColumn> = {}): BoardColumn {
  return {
    id: 'column-1',
    boardId: 'board-1',
    title: 'Todo',
    position: 1000,
    ...over,
  };
}

export function testPriority(over: Partial<BoardPriority> = {}): BoardPriority {
  return {
    id: 'priority-1',
    boardId: 'board-1',
    name: 'critical',
    color: 'red',
    order: 1,
    ...over,
  };
}

/** The four default priorities a new board starts with. */
export function testPriorities(): BoardPriority[] {
  return [
    testPriority(),
    testPriority({ id: 'priority-2', name: 'high', color: 'orange', order: 2 }),
    testPriority({
      id: 'priority-3',
      name: 'medium',
      color: undefined,
      order: 3,
    }),
    testPriority({ id: 'priority-4', name: 'low', color: undefined, order: 4 }),
  ];
}

/** Board actions where every handler is a jest mock. */
export function testActions(): jest.Mocked<BoardActions> {
  return {
    moveItem: jest.fn().mockResolvedValue(undefined),
    createItem: jest.fn().mockResolvedValue(undefined),
    renameColumn: jest.fn().mockResolvedValue(undefined),
    reorderColumn: jest.fn().mockResolvedValue(undefined),
    addColumn: jest.fn().mockResolvedValue(undefined),
    setColumnColor: jest.fn().mockResolvedValue(undefined),
    setColumnWipLimits: jest.fn().mockResolvedValue(undefined),
    deleteColumn: jest.fn().mockResolvedValue(undefined),
    openItem: jest.fn(),
    renameItem: jest.fn().mockResolvedValue(undefined),
    setItemDueDate: jest.fn().mockResolvedValue(undefined),
    setAssignees: jest.fn().mockResolvedValue(undefined),
    setItemPriority: jest.fn().mockResolvedValue(undefined),
    deleteItem: jest.fn().mockResolvedValue(undefined),
  };
}

/** Bulk actions where every handler is a jest mock. */
export function testBulkActions(): jest.Mocked<BulkActions> {
  return {
    moveItems: jest.fn().mockResolvedValue(undefined),
    updateItems: jest.fn().mockResolvedValue(undefined),
    archiveItems: jest.fn().mockResolvedValue(undefined),
  };
}

/** A BoardsApi where every method is a jest mock with an empty result. */
export function testBoardsApi(
  over: Partial<jest.Mocked<BoardsApi>> = {},
): jest.Mocked<BoardsApi> {
  return {
    listBoards: jest.fn().mockResolvedValue({ boards: [], total: 0 }),
    listFilterOptions: jest.fn().mockResolvedValue({
      total: 0,
      favorites: 0,
      entityRefs: [],
      creators: [],
    }),
    createBoard: jest.fn(),
    listMyItems: jest.fn().mockResolvedValue([]),
    getBoard: jest.fn(),
    updateBoard: jest.fn().mockResolvedValue(undefined),
    deleteBoard: jest.fn().mockResolvedValue(undefined),
    hardDeleteBoard: jest.fn().mockResolvedValue(undefined),
    unarchiveBoard: jest.fn().mockResolvedValue(undefined),
    duplicateBoard: jest.fn(),
    setFavorite: jest.fn().mockResolvedValue(undefined),
    setWatchBoard: jest.fn().mockResolvedValue(undefined),
    listPermissions: jest.fn().mockResolvedValue([]),
    addPermission: jest.fn(),
    updatePermission: jest.fn(),
    removePermission: jest.fn().mockResolvedValue(undefined),
    addColumn: jest.fn(),
    updateColumn: jest.fn(),
    deleteColumn: jest.fn().mockResolvedValue(undefined),
    addPriority: jest.fn(),
    updatePriority: jest.fn(),
    deletePriority: jest.fn().mockResolvedValue(undefined),
    listItems: jest.fn().mockResolvedValue([]),
    createItem: jest.fn(),
    updateItem: jest.fn(),
    moveItem: jest.fn(),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    listArchivedItems: jest.fn().mockResolvedValue([]),
    restoreItem: jest.fn(),
    setWatchItem: jest.fn().mockResolvedValue(undefined),
    listBoardWatchers: jest.fn().mockResolvedValue([]),
    getBoardChanges: jest.fn().mockResolvedValue([]),
    listItemWatchers: jest.fn().mockResolvedValue([]),
    addComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn().mockResolvedValue(undefined),
    listCommentVersions: jest.fn().mockResolvedValue([]),
    listDescriptionVersions: jest.fn().mockResolvedValue([]),
    getTimeline: jest.fn().mockResolvedValue([]),
    ...over,
  };
}

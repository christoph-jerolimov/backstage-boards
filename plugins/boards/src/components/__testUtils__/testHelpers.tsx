import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { BoardColumn, BoardItem } from '@internal/plugin-boards-common';
import { BoardsApi } from '../../api';
import { BoardActions } from '../KanbanView';

/**
 * Renders a component inside a test app (routing and app context, which
 * catalog entity links need) with a fresh query client and any stubbed
 * APIs.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: { apis?: any[]; mountedRoutes?: Record<string, any> },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderInTestApp(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    {
      apis: options?.apis ?? [],
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

/** Board actions where every handler is a jest mock. */
export function testActions(): jest.Mocked<BoardActions> {
  return {
    moveItem: jest.fn().mockResolvedValue(undefined),
    createItem: jest.fn().mockResolvedValue(undefined),
    renameColumn: jest.fn().mockResolvedValue(undefined),
    reorderColumn: jest.fn().mockResolvedValue(undefined),
    addColumn: jest.fn().mockResolvedValue(undefined),
    setColumnColor: jest.fn().mockResolvedValue(undefined),
    deleteColumn: jest.fn().mockResolvedValue(undefined),
    openItem: jest.fn(),
    renameItem: jest.fn().mockResolvedValue(undefined),
    setItemDueDate: jest.fn().mockResolvedValue(undefined),
    setAssignees: jest.fn().mockResolvedValue(undefined),
    deleteItem: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BoardActions>;
}

/** A BoardsApi where every method is a jest mock with an empty result. */
export function testBoardsApi(over: Partial<BoardsApi> = {}): jest.Mocked<BoardsApi> {
  return {
    listBoards: jest.fn().mockResolvedValue([]),
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
  } as unknown as jest.Mocked<BoardsApi>;
}

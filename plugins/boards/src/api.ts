import { createApiRef, DiscoveryApi } from '@backstage/frontend-plugin-api';
import {
  Board,
  BoardChangeEntry,
  BoardFilterOptions,
  BoardListFilter,
  BoardListResult,
  BoardColumn,
  BoardItem,
  BoardPermissionEntry,
  BoardPermissionLevel,
  BoardUpdate,
  BoardWithContext,
  ColumnColor,
  CommentVersion,
  ItemComment,
  ItemUpdate,
  MyBoardItem,
  NewItem,
  TimelineEntry,
} from '@internal/plugin-boards-common';

/** The message of a Backstage `{ error: { message } }` payload, if present. */
function errorPayloadMessage(payload: unknown): string | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('error' in payload)
  ) {
    return undefined;
  }
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }
  return typeof error.message === 'string' ? error.message : undefined;
}

/** The filters and paging one board listing request carries. */
export interface BoardListQuery extends BoardListFilter {
  /** Also return each board's per-column item counts. */
  withCounts?: boolean;
  limit?: number;
  offset?: number;
}

export interface BoardsApi {
  /**
   * One page of the boards the user can read. Without a `limit` the
   * whole listing comes back in one response.
   */
  listBoards(options?: BoardListQuery): Promise<BoardListResult>;
  /** The options the board list's filter dropdowns offer. */
  listFilterOptions(): Promise<BoardFilterOptions>;
  createBoard(options: {
    name: string;
    columns?: string[];
    entityRefs?: string[];
  }): Promise<BoardWithContext>;
  /** All items assigned to the current user across readable boards. */
  listMyItems(): Promise<MyBoardItem[]>;
  getBoard(boardId: string): Promise<BoardWithContext>;
  updateBoard(boardId: string, update: BoardUpdate): Promise<BoardWithContext>;
  /** Archives the board (read-only, purged after 30 days). */
  deleteBoard(boardId: string): Promise<void>;
  /** Permanently deletes an archived board immediately. */
  hardDeleteBoard(boardId: string): Promise<void>;
  /** Restores an archived board to its normal state. */
  unarchiveBoard(boardId: string): Promise<void>;
  duplicateBoard(
    boardId: string,
    options: {
      name?: string;
      copyColumns: boolean;
      copyItems?: boolean;
      copyEntities?: boolean;
      copyPermissions: boolean;
    },
  ): Promise<BoardWithContext>;
  setFavorite(boardId: string, favorite: boolean): Promise<void>;
  setWatchBoard(boardId: string, watching: boolean): Promise<void>;

  listPermissions(boardId: string): Promise<BoardPermissionEntry[]>;
  addPermission(
    boardId: string,
    entry: { principalRef: string; level: BoardPermissionLevel },
  ): Promise<BoardPermissionEntry>;
  updatePermission(
    boardId: string,
    permissionId: string,
    level: BoardPermissionLevel,
  ): Promise<BoardPermissionEntry>;
  removePermission(boardId: string, permissionId: string): Promise<void>;

  addColumn(
    boardId: string,
    options: { title: string; position?: number; color?: ColumnColor },
  ): Promise<BoardColumn>;
  updateColumn(
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number; color?: ColumnColor | null },
  ): Promise<BoardColumn>;
  deleteColumn(
    boardId: string,
    columnId: string,
    options?: { moveItemsTo?: string },
  ): Promise<void>;

  listItems(boardId: string): Promise<BoardItem[]>;
  createItem(boardId: string, item: NewItem): Promise<BoardItem>;
  updateItem(
    boardId: string,
    itemId: string,
    update: ItemUpdate,
  ): Promise<BoardItem>;
  moveItem(
    boardId: string,
    itemId: string,
    target: { columnId: string; position?: number },
  ): Promise<BoardItem>;
  deleteItem(boardId: string, itemId: string): Promise<void>;
  listArchivedItems(boardId: string): Promise<BoardItem[]>;
  restoreItem(boardId: string, itemId: string): Promise<BoardItem>;
  setWatchItem(
    boardId: string,
    itemId: string,
    watching: boolean,
  ): Promise<void>;
  listBoardWatchers(boardId: string): Promise<string[]>;
  getBoardChanges(
    boardId: string,
    options?: { limit?: number },
  ): Promise<BoardChangeEntry[]>;
  listItemWatchers(boardId: string, itemId: string): Promise<string[]>;

  addComment(
    boardId: string,
    itemId: string,
    text: string,
  ): Promise<ItemComment>;
  updateComment(
    boardId: string,
    itemId: string,
    commentId: string,
    text: string,
  ): Promise<ItemComment>;
  deleteComment(
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<void>;
  listCommentVersions(
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<CommentVersion[]>;
  listDescriptionVersions(
    boardId: string,
    itemId: string,
  ): Promise<CommentVersion[]>;
  getTimeline(boardId: string, itemId: string): Promise<TimelineEntry[]>;
}

export const boardsApiRef = createApiRef<BoardsApi>({
  id: 'plugin.boards.api',
});

/**
 * The response members this client reads. A real `Response` satisfies it,
 * and naming them keeps a stand-in from having to pretend to be one.
 */
export type BoardsFetchResponse = Pick<
  Response,
  'ok' | 'status' | 'statusText' | 'json'
>;

/** The discovery and fetch this client needs; the app's own APIs satisfy it. */
export interface BoardsClientOptions {
  discoveryApi: Pick<DiscoveryApi, 'getBaseUrl'>;
  fetchApi: {
    fetch(url: string, init: RequestInit): Promise<BoardsFetchResponse>;
  };
}

export class BoardsClient implements BoardsApi {
  constructor(private readonly options: BoardsClientOptions) {}

  /** Calls the backend, turning a non-2xx response into an error. */
  private async fetch(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<BoardsFetchResponse> {
    const baseUrl = await this.options.discoveryApi.getBaseUrl('boards');
    const response = await this.options.fetchApi.fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        message = errorPayloadMessage(await response.json()) ?? message;
      } catch {
        // keep the default message
      }
      throw new Error(message);
    }
    return response;
  }

  /** A call whose JSON body is the result. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetch(method, path, body);
    // the one place a cast is unavoidable: the wire carries no types
    return (await response.json()) as T;
  }

  /** A call whose response carries nothing the caller needs. */
  private async requestVoid(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<void> {
    await this.fetch(method, path, body);
  }

  /** A list endpoint's payload is always the rows under one key. */
  private async requestList<T>(path: string, key: string): Promise<T[]> {
    const result = await this.request<Record<string, T[]>>('GET', path);
    return result[key];
  }

  /** Endpoints where PUT adds the current user and DELETE removes them. */
  private toggle(on: boolean, path: string): Promise<void> {
    return this.requestVoid(on ? 'PUT' : 'DELETE', path);
  }

  listBoards(options?: BoardListQuery): Promise<BoardListResult> {
    const params = new URLSearchParams();
    if (options?.favoritesOnly) {
      params.set('favorites', 'true');
    }
    if (options?.entityRef) {
      params.set('entityRef', options.entityRef);
    }
    if (options?.withCounts) {
      params.set('counts', 'true');
    }
    if (options?.search?.trim()) {
      params.set('search', options.search.trim());
    }
    if (options?.createdBy) {
      params.set('createdBy', options.createdBy);
    }
    if (options?.limit !== undefined) {
      // offset only means anything alongside a limit
      params.set('limit', String(options.limit));
      params.set('offset', String(options.offset ?? 0));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/boards${query}`);
  }

  listFilterOptions(): Promise<BoardFilterOptions> {
    return this.request('GET', '/boards/facets');
  }

  listMyItems(): Promise<MyBoardItem[]> {
    return this.requestList<MyBoardItem>('/my-items', 'items');
  }

  createBoard(options: {
    name: string;
    columns?: string[];
    entityRefs?: string[];
  }): Promise<BoardWithContext> {
    return this.request('POST', '/boards', options);
  }

  getBoard(boardId: string): Promise<BoardWithContext> {
    return this.request('GET', `/boards/${boardId}`);
  }

  updateBoard(boardId: string, update: BoardUpdate): Promise<BoardWithContext> {
    return this.request('PATCH', `/boards/${boardId}`, update);
  }

  deleteBoard(boardId: string): Promise<void> {
    return this.requestVoid('DELETE', `/boards/${boardId}`);
  }

  hardDeleteBoard(boardId: string): Promise<void> {
    return this.requestVoid('POST', `/boards/${boardId}/delete-now`);
  }

  unarchiveBoard(boardId: string): Promise<void> {
    return this.requestVoid('POST', `/boards/${boardId}/unarchive`);
  }

  duplicateBoard(
    boardId: string,
    options: {
      name?: string;
      copyColumns: boolean;
      copyItems?: boolean;
      copyEntities?: boolean;
      copyPermissions: boolean;
    },
  ): Promise<BoardWithContext> {
    return this.request('POST', `/boards/${boardId}/duplicate`, options);
  }

  setFavorite(boardId: string, favorite: boolean): Promise<void> {
    return this.toggle(favorite, `/boards/${boardId}/favorite`);
  }

  setWatchBoard(boardId: string, watching: boolean): Promise<void> {
    return this.toggle(watching, `/boards/${boardId}/watch`);
  }

  listPermissions(boardId: string): Promise<BoardPermissionEntry[]> {
    return this.requestList<BoardPermissionEntry>(
      `/boards/${boardId}/permissions`,
      'permissions',
    );
  }

  addPermission(
    boardId: string,
    entry: { principalRef: string; level: BoardPermissionLevel },
  ): Promise<BoardPermissionEntry> {
    return this.request('POST', `/boards/${boardId}/permissions`, entry);
  }

  updatePermission(
    boardId: string,
    permissionId: string,
    level: BoardPermissionLevel,
  ): Promise<BoardPermissionEntry> {
    return this.request(
      'PATCH',
      `/boards/${boardId}/permissions/${permissionId}`,
      { level },
    );
  }

  removePermission(boardId: string, permissionId: string): Promise<void> {
    return this.requestVoid(
      'DELETE',
      `/boards/${boardId}/permissions/${permissionId}`,
    );
  }

  addColumn(
    boardId: string,
    options: { title: string; position?: number; color?: ColumnColor },
  ): Promise<BoardColumn> {
    return this.request('POST', `/boards/${boardId}/columns`, options);
  }

  updateColumn(
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number; color?: ColumnColor | null },
  ): Promise<BoardColumn> {
    return this.request(
      'PATCH',
      `/boards/${boardId}/columns/${columnId}`,
      update,
    );
  }

  deleteColumn(
    boardId: string,
    columnId: string,
    options?: { moveItemsTo?: string },
  ): Promise<void> {
    const query = options?.moveItemsTo
      ? `?moveItemsTo=${encodeURIComponent(options.moveItemsTo)}`
      : '';
    return this.requestVoid(
      'DELETE',
      `/boards/${boardId}/columns/${columnId}${query}`,
    );
  }

  listItems(boardId: string): Promise<BoardItem[]> {
    return this.requestList<BoardItem>(`/boards/${boardId}/items`, 'items');
  }

  createItem(boardId: string, item: NewItem): Promise<BoardItem> {
    return this.request('POST', `/boards/${boardId}/items`, item);
  }

  updateItem(
    boardId: string,
    itemId: string,
    update: ItemUpdate,
  ): Promise<BoardItem> {
    return this.request('PATCH', `/boards/${boardId}/items/${itemId}`, update);
  }

  moveItem(
    boardId: string,
    itemId: string,
    target: { columnId: string; position?: number },
  ): Promise<BoardItem> {
    return this.request(
      'POST',
      `/boards/${boardId}/items/${itemId}/move`,
      target,
    );
  }

  deleteItem(boardId: string, itemId: string): Promise<void> {
    return this.requestVoid('DELETE', `/boards/${boardId}/items/${itemId}`);
  }

  listArchivedItems(boardId: string): Promise<BoardItem[]> {
    return this.requestList<BoardItem>(
      `/boards/${boardId}/items/archived`,
      'items',
    );
  }

  restoreItem(boardId: string, itemId: string): Promise<BoardItem> {
    return this.request('POST', `/boards/${boardId}/items/${itemId}/restore`);
  }

  setWatchItem(
    boardId: string,
    itemId: string,
    watching: boolean,
  ): Promise<void> {
    return this.toggle(watching, `/boards/${boardId}/items/${itemId}/watch`);
  }

  async getBoardChanges(
    boardId: string,
    options?: { limit?: number },
  ): Promise<BoardChangeEntry[]> {
    const query = options?.limit ? `?limit=${options.limit}` : '';
    return this.requestList<BoardChangeEntry>(
      `/boards/${boardId}/changes${query}`,
      'changes',
    );
  }

  listBoardWatchers(boardId: string): Promise<string[]> {
    return this.requestList<string>(`/boards/${boardId}/watchers`, 'watchers');
  }

  listItemWatchers(boardId: string, itemId: string): Promise<string[]> {
    return this.requestList<string>(
      `/boards/${boardId}/items/${itemId}/watchers`,
      'watchers',
    );
  }

  addComment(
    boardId: string,
    itemId: string,
    text: string,
  ): Promise<ItemComment> {
    return this.request('POST', `/boards/${boardId}/items/${itemId}/comments`, {
      text,
    });
  }

  updateComment(
    boardId: string,
    itemId: string,
    commentId: string,
    text: string,
  ): Promise<ItemComment> {
    return this.request(
      'PATCH',
      `/boards/${boardId}/items/${itemId}/comments/${commentId}`,
      { text },
    );
  }

  deleteComment(
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<void> {
    return this.requestVoid(
      'DELETE',
      `/boards/${boardId}/items/${itemId}/comments/${commentId}`,
    );
  }

  listCommentVersions(
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<CommentVersion[]> {
    return this.requestList<CommentVersion>(
      `/boards/${boardId}/items/${itemId}/comments/${commentId}/versions`,
      'versions',
    );
  }

  listDescriptionVersions(
    boardId: string,
    itemId: string,
  ): Promise<CommentVersion[]> {
    return this.requestList<CommentVersion>(
      `/boards/${boardId}/items/${itemId}/description/versions`,
      'versions',
    );
  }

  getTimeline(boardId: string, itemId: string): Promise<TimelineEntry[]> {
    return this.requestList<TimelineEntry>(
      `/boards/${boardId}/items/${itemId}/timeline`,
      'timeline',
    );
  }
}

export type { Board };

import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/frontend-plugin-api';
import {
  Board,
  BoardChangeEntry,
  BoardColumn,
  BoardItem,
  BoardListEntry,
  BoardPermissionEntry,
  BoardPermissionLevel,
  BoardUpdate,
  BoardWithContext,
  CommentVersion,
  ItemComment,
  ItemUpdate,
  MyBoardItem,
  NewItem,
  TimelineEntry,
} from '@internal/plugin-boards-common';

export interface BoardsApi {
  listBoards(options?: {
    favoritesOnly?: boolean;
    entityRef?: string;
    /** Also return each board's per-column item counts. */
    withCounts?: boolean;
  }): Promise<BoardListEntry[]>;
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
    options: { title: string; position?: number; color?: string },
  ): Promise<BoardColumn>;
  updateColumn(
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number; color?: string | null },
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

export class BoardsClient implements BoardsApi {
  constructor(
    private readonly options: {
      discoveryApi: DiscoveryApi;
      fetchApi: FetchApi;
    },
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const baseUrl = await this.options.discoveryApi.getBaseUrl('boards');
    const response = await this.options.fetchApi.fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const payload = await response.json();
        message = payload?.error?.message ?? message;
      } catch {
        // keep the default message
      }
      throw new Error(message);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  /** A list endpoint's payload is always the rows under one key. */
  private async requestList<T>(path: string, key: string): Promise<T[]> {
    const result = await this.request<Record<string, T[]>>('GET', path);
    return result[key];
  }

  /** Endpoints where PUT adds the current user and DELETE removes them. */
  private toggle(on: boolean, path: string): Promise<void> {
    return this.request(on ? 'PUT' : 'DELETE', path);
  }

  async listBoards(options?: {
    favoritesOnly?: boolean;
    entityRef?: string;
    withCounts?: boolean;
  }): Promise<BoardListEntry[]> {
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
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestList<BoardListEntry>(`/boards${query}`, 'boards');
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
    return this.request('DELETE', `/boards/${boardId}`);
  }

  hardDeleteBoard(boardId: string): Promise<void> {
    return this.request('POST', `/boards/${boardId}/delete-now`);
  }

  unarchiveBoard(boardId: string): Promise<void> {
    return this.request('POST', `/boards/${boardId}/unarchive`);
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
    return this.request(
      'DELETE',
      `/boards/${boardId}/permissions/${permissionId}`,
    );
  }

  addColumn(
    boardId: string,
    options: { title: string; position?: number; color?: string },
  ): Promise<BoardColumn> {
    return this.request('POST', `/boards/${boardId}/columns`, options);
  }

  updateColumn(
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number; color?: string | null },
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
    return this.request(
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
    return this.request('DELETE', `/boards/${boardId}/items/${itemId}`);
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
    return this.request(
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

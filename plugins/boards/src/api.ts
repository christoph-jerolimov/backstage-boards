import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/frontend-plugin-api';
import {
  Board,
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
  NewItem,
  TimelineEntry,
} from '@internal/plugin-boards-common';

export interface BoardsApi {
  listBoards(options?: { favoritesOnly?: boolean }): Promise<BoardListEntry[]>;
  createBoard(options: {
    name: string;
    columns?: string[];
    entityRef?: string;
  }): Promise<BoardWithContext>;
  getBoard(boardId: string): Promise<BoardWithContext>;
  updateBoard(boardId: string, update: BoardUpdate): Promise<BoardWithContext>;
  deleteBoard(boardId: string): Promise<void>;
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
    options: { title: string; position?: number },
  ): Promise<BoardColumn>;
  updateColumn(
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number },
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
  setWatchItem(
    boardId: string,
    itemId: string,
    watching: boolean,
  ): Promise<void>;
  listBoardWatchers(boardId: string): Promise<string[]>;
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
      headers:
        body === undefined ? {} : { 'Content-Type': 'application/json' },
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

  async listBoards(options?: {
    favoritesOnly?: boolean;
  }): Promise<BoardListEntry[]> {
    const query = options?.favoritesOnly ? '?favorites=true' : '';
    const result = await this.request<{ boards: BoardListEntry[] }>(
      'GET',
      `/boards${query}`,
    );
    return result.boards;
  }

  createBoard(options: {
    name: string;
    columns?: string[];
    entityRef?: string;
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

  setFavorite(boardId: string, favorite: boolean): Promise<void> {
    return this.request(
      favorite ? 'PUT' : 'DELETE',
      `/boards/${boardId}/favorite`,
    );
  }

  setWatchBoard(boardId: string, watching: boolean): Promise<void> {
    return this.request(
      watching ? 'PUT' : 'DELETE',
      `/boards/${boardId}/watch`,
    );
  }

  async listPermissions(boardId: string): Promise<BoardPermissionEntry[]> {
    const result = await this.request<{ permissions: BoardPermissionEntry[] }>(
      'GET',
      `/boards/${boardId}/permissions`,
    );
    return result.permissions;
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
    options: { title: string; position?: number },
  ): Promise<BoardColumn> {
    return this.request('POST', `/boards/${boardId}/columns`, options);
  }

  updateColumn(
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number },
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

  async listItems(boardId: string): Promise<BoardItem[]> {
    const result = await this.request<{ items: BoardItem[] }>(
      'GET',
      `/boards/${boardId}/items`,
    );
    return result.items;
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

  setWatchItem(
    boardId: string,
    itemId: string,
    watching: boolean,
  ): Promise<void> {
    return this.request(
      watching ? 'PUT' : 'DELETE',
      `/boards/${boardId}/items/${itemId}/watch`,
    );
  }

  async listBoardWatchers(boardId: string): Promise<string[]> {
    const result = await this.request<{ watchers: string[] }>(
      'GET',
      `/boards/${boardId}/watchers`,
    );
    return result.watchers;
  }

  async listItemWatchers(boardId: string, itemId: string): Promise<string[]> {
    const result = await this.request<{ watchers: string[] }>(
      'GET',
      `/boards/${boardId}/items/${itemId}/watchers`,
    );
    return result.watchers;
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

  async listCommentVersions(
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<CommentVersion[]> {
    const result = await this.request<{ versions: CommentVersion[] }>(
      'GET',
      `/boards/${boardId}/items/${itemId}/comments/${commentId}/versions`,
    );
    return result.versions;
  }

  async listDescriptionVersions(
    boardId: string,
    itemId: string,
  ): Promise<CommentVersion[]> {
    const result = await this.request<{ versions: CommentVersion[] }>(
      'GET',
      `/boards/${boardId}/items/${itemId}/description/versions`,
    );
    return result.versions;
  }

  async getTimeline(
    boardId: string,
    itemId: string,
  ): Promise<TimelineEntry[]> {
    const result = await this.request<{ timeline: TimelineEntry[] }>(
      'GET',
      `/boards/${boardId}/items/${itemId}/timeline`,
    );
    return result.timeline;
  }
}

export type { Board };

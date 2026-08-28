import { BoardsClient, BoardsFetchResponse } from './api';

function setup(
  responder?: (url: string, init: RequestInit) => Partial<BoardsFetchResponse>,
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = jest.fn(
    async (url: string, init: RequestInit): Promise<BoardsFetchResponse> => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
        ...responder?.(url, init),
      };
    },
  );
  const client = new BoardsClient({
    discoveryApi: { getBaseUrl: async () => 'http://backstage/api/boards' },
    fetchApi: { fetch },
  });
  return { client, calls, fetch };
}

/** The body of the n-th request, parsed back from JSON. */
function bodyOf(init: RequestInit) {
  return init.body === undefined ? undefined : JSON.parse(init.body as string);
}

describe('BoardsClient request handling', () => {
  it('sends GET requests without a body or content type', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ boards: [] }),
    }));
    await client.listBoards();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://backstage/api/boards/boards');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[0].init.headers).toEqual({});
  });

  it('sends JSON bodies with a content type', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ board: { id: 'board-1' } }),
    }));
    await client.createBoard({ name: 'Roadmap', columns: ['Todo'] });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(bodyOf(calls[0].init)).toEqual({
      name: 'Roadmap',
      columns: ['Todo'],
    });
  });

  it('resolves to undefined on 204 responses without parsing a body', async () => {
    const json = jest.fn();
    const { client } = setup(() => ({ status: 204, json }));
    await expect(client.deleteBoard('board-1')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('throws the error message from the response payload', async () => {
    const { client } = setup(() => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: { message: 'Not allowed to write' } }),
    }));
    await expect(client.getBoard('board-1')).rejects.toThrow(
      'Not allowed to write',
    );
  });

  it('falls back to status and status text for unparsable errors', async () => {
    const { client } = setup(() => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    }));
    await expect(client.getBoard('board-1')).rejects.toThrow(
      '500 Internal Server Error',
    );
  });

  it('falls back to status and status text when the payload has no message', async () => {
    const { client } = setup(() => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: {} }),
    }));
    await expect(client.getBoard('board-1')).rejects.toThrow('404 Not Found');
  });
});

describe('BoardsClient board endpoints', () => {
  it('unwraps and filters the board list', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ boards: [{ id: 'board-1' }] }),
    }));
    await expect(client.listBoards()).resolves.toEqual([{ id: 'board-1' }]);

    await client.listBoards({ favoritesOnly: true });
    expect(calls[1].url).toBe(
      'http://backstage/api/boards/boards?favorites=true',
    );

    await client.listBoards({ entityRef: 'component:default/www' });
    expect(calls[2].url).toBe(
      'http://backstage/api/boards/boards?entityRef=component%3Adefault%2Fwww',
    );

    await client.listBoards({ favoritesOnly: false });
    expect(calls[3].url).toBe('http://backstage/api/boards/boards');

    await client.listBoards({ withCounts: true });
    expect(calls[4].url).toBe('http://backstage/api/boards/boards?counts=true');

    await client.listBoards({ favoritesOnly: true, withCounts: true });
    expect(calls[5].url).toBe(
      'http://backstage/api/boards/boards?favorites=true&counts=true',
    );

    await client.listBoards({ withCounts: false });
    expect(calls[6].url).toBe('http://backstage/api/boards/boards');
  });

  it('unwraps my items', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ items: [{ id: 'item-1' }] }),
    }));
    await expect(client.listMyItems()).resolves.toEqual([{ id: 'item-1' }]);
    expect(calls[0].url).toBe('http://backstage/api/boards/my-items');
  });

  it('maps the board lifecycle endpoints', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.updateBoard('board-1', { name: 'Renamed' });
    await client.deleteBoard('board-1');
    await client.hardDeleteBoard('board-1');
    await client.unarchiveBoard('board-1');
    await client.duplicateBoard('board-1', {
      copyColumns: true,
      copyPermissions: false,
    });
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'PATCH http://backstage/api/boards/boards/board-1',
      'DELETE http://backstage/api/boards/boards/board-1',
      'POST http://backstage/api/boards/boards/board-1/delete-now',
      'POST http://backstage/api/boards/boards/board-1/unarchive',
      'POST http://backstage/api/boards/boards/board-1/duplicate',
    ]);
    expect(bodyOf(calls[0].init)).toEqual({ name: 'Renamed' });
    expect(bodyOf(calls[4].init)).toEqual({
      copyColumns: true,
      copyPermissions: false,
    });
  });

  it('toggles favorites and board watches with PUT and DELETE', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.setFavorite('board-1', true);
    await client.setFavorite('board-1', false);
    await client.setWatchBoard('board-1', true);
    await client.setWatchBoard('board-1', false);
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'PUT http://backstage/api/boards/boards/board-1/favorite',
      'DELETE http://backstage/api/boards/boards/board-1/favorite',
      'PUT http://backstage/api/boards/boards/board-1/watch',
      'DELETE http://backstage/api/boards/boards/board-1/watch',
    ]);
  });

  it('unwraps board changes and passes the limit', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ changes: [{ id: 'change-1' }] }),
    }));
    await expect(client.getBoardChanges('board-1')).resolves.toEqual([
      { id: 'change-1' },
    ]);
    expect(calls[0].url).toBe(
      'http://backstage/api/boards/boards/board-1/changes',
    );
    await client.getBoardChanges('board-1', { limit: 25 });
    expect(calls[1].url).toBe(
      'http://backstage/api/boards/boards/board-1/changes?limit=25',
    );
  });

  it('unwraps board watchers', async () => {
    const { client } = setup(() => ({
      json: async () => ({ watchers: ['user:default/alice'] }),
    }));
    await expect(client.listBoardWatchers('board-1')).resolves.toEqual([
      'user:default/alice',
    ]);
  });
});

describe('BoardsClient permission endpoints', () => {
  it('unwraps the permission list', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ permissions: [{ id: 'perm-1' }] }),
    }));
    await expect(client.listPermissions('board-1')).resolves.toEqual([
      { id: 'perm-1' },
    ]);
    expect(calls[0].url).toBe(
      'http://backstage/api/boards/boards/board-1/permissions',
    );
  });

  it('adds, updates and removes permissions', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.addPermission('board-1', {
      principalRef: 'user:default/bob',
      level: 'write',
    });
    await client.updatePermission('board-1', 'perm-1', 'admin');
    await client.removePermission('board-1', 'perm-1');
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'POST http://backstage/api/boards/boards/board-1/permissions',
      'PATCH http://backstage/api/boards/boards/board-1/permissions/perm-1',
      'DELETE http://backstage/api/boards/boards/board-1/permissions/perm-1',
    ]);
    expect(bodyOf(calls[0].init)).toEqual({
      principalRef: 'user:default/bob',
      level: 'write',
    });
    expect(bodyOf(calls[1].init)).toEqual({ level: 'admin' });
  });
});

describe('BoardsClient column endpoints', () => {
  it('adds and updates columns', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.addColumn('board-1', { title: 'Todo', position: 0 });
    await client.updateColumn('board-1', 'column-1', { color: null });
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'POST http://backstage/api/boards/boards/board-1/columns',
      'PATCH http://backstage/api/boards/boards/board-1/columns/column-1',
    ]);
    expect(bodyOf(calls[0].init)).toEqual({ title: 'Todo', position: 0 });
    expect(bodyOf(calls[1].init)).toEqual({ color: null });
  });

  it('omits the position entirely when adding without one', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    // the backend appends only while `position` is absent from the body,
    // so an undefined position must not survive as a null
    await client.addColumn('board-1', { title: 'Todo', position: undefined });
    expect(bodyOf(calls[0].init)).toEqual({ title: 'Todo' });
    expect('position' in bodyOf(calls[0].init)).toBe(false);
  });

  it('deletes columns, optionally moving the items', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.deleteColumn('board-1', 'column-1');
    expect(calls[0].url).toBe(
      'http://backstage/api/boards/boards/board-1/columns/column-1',
    );
    await client.deleteColumn('board-1', 'column-1', {
      moveItemsTo: 'column 2',
    });
    expect(calls[1].url).toBe(
      'http://backstage/api/boards/boards/board-1/columns/column-1?moveItemsTo=column%202',
    );
  });

  it('adds, updates and deletes priorities', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ id: 'priority-1' }),
    }));
    await client.addPriority('board-1', { name: 'blocker', color: 'purple' });
    expect(calls[0].url).toBe(
      'http://backstage/api/boards/boards/board-1/priorities',
    );
    expect(calls[0].init.method).toBe('POST');
    expect(bodyOf(calls[0].init)).toEqual({ name: 'blocker', color: 'purple' });
    await client.updatePriority('board-1', 'priority-1', {
      name: 'Blocker',
      color: null,
      order: 1,
    });
    expect(calls[1].url).toBe(
      'http://backstage/api/boards/boards/board-1/priorities/priority-1',
    );
    expect(calls[1].init.method).toBe('PATCH');
    expect(bodyOf(calls[1].init)).toEqual({
      name: 'Blocker',
      color: null,
      order: 1,
    });
    await client.deletePriority('board-1', 'priority-1');
    expect(calls[2].url).toBe(
      'http://backstage/api/boards/boards/board-1/priorities/priority-1',
    );
    expect(calls[2].init.method).toBe('DELETE');
    await client.deletePriority('board-1', 'priority-1', {
      reassignTo: 'priority-2',
    });
    expect(calls[3].url).toBe(
      'http://backstage/api/boards/boards/board-1/priorities/priority-1?reassignTo=priority-2',
    );
    await client.deletePriority('board-1', 'priority-1', { drop: true });
    expect(calls[4].url).toBe(
      'http://backstage/api/boards/boards/board-1/priorities/priority-1?drop=true',
    );
  });
});

describe('BoardsClient item endpoints', () => {
  it('unwraps the item lists', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ items: [{ id: 'item-1' }] }),
    }));
    await expect(client.listItems('board-1')).resolves.toEqual([
      { id: 'item-1' },
    ]);
    await expect(client.listArchivedItems('board-1')).resolves.toEqual([
      { id: 'item-1' },
    ]);
    expect(calls.map(call => call.url)).toEqual([
      'http://backstage/api/boards/boards/board-1/items',
      'http://backstage/api/boards/boards/board-1/items/archived',
    ]);
  });

  it('creates, updates, moves, deletes and restores items', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.createItem('board-1', {
      columnId: 'column-1',
      title: 'New',
    });
    await client.updateItem('board-1', 'item-1', { title: 'Renamed' });
    await client.moveItem('board-1', 'item-1', {
      columnId: 'column-2',
      position: 1,
    });
    await client.deleteItem('board-1', 'item-1');
    await client.restoreItem('board-1', 'item-1');
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'POST http://backstage/api/boards/boards/board-1/items',
      'PATCH http://backstage/api/boards/boards/board-1/items/item-1',
      'POST http://backstage/api/boards/boards/board-1/items/item-1/move',
      'DELETE http://backstage/api/boards/boards/board-1/items/item-1',
      'POST http://backstage/api/boards/boards/board-1/items/item-1/restore',
    ]);
    expect(bodyOf(calls[2].init)).toEqual({
      columnId: 'column-2',
      position: 1,
    });
  });

  it('toggles item watches with PUT and DELETE', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.setWatchItem('board-1', 'item-1', true);
    await client.setWatchItem('board-1', 'item-1', false);
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'PUT http://backstage/api/boards/boards/board-1/items/item-1/watch',
      'DELETE http://backstage/api/boards/boards/board-1/items/item-1/watch',
    ]);
  });

  it('unwraps item watchers', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ watchers: ['user:default/bob'] }),
    }));
    await expect(client.listItemWatchers('board-1', 'item-1')).resolves.toEqual(
      ['user:default/bob'],
    );
    expect(calls[0].url).toBe(
      'http://backstage/api/boards/boards/board-1/items/item-1/watchers',
    );
  });

  it('unwraps the item timeline', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ timeline: [{ kind: 'comment' }] }),
    }));
    await expect(client.getTimeline('board-1', 'item-1')).resolves.toEqual([
      { kind: 'comment' },
    ]);
    expect(calls[0].url).toBe(
      'http://backstage/api/boards/boards/board-1/items/item-1/timeline',
    );
  });
});

describe('BoardsClient comment endpoints', () => {
  it('adds, updates and deletes comments', async () => {
    const { client, calls } = setup(() => ({ status: 204 }));
    await client.addComment('board-1', 'item-1', 'Hello');
    await client.updateComment('board-1', 'item-1', 'comment-1', 'Edited');
    await client.deleteComment('board-1', 'item-1', 'comment-1');
    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'POST http://backstage/api/boards/boards/board-1/items/item-1/comments',
      'PATCH http://backstage/api/boards/boards/board-1/items/item-1/comments/comment-1',
      'DELETE http://backstage/api/boards/boards/board-1/items/item-1/comments/comment-1',
    ]);
    expect(bodyOf(calls[0].init)).toEqual({ text: 'Hello' });
    expect(bodyOf(calls[1].init)).toEqual({ text: 'Edited' });
  });

  it('unwraps comment and description versions', async () => {
    const { client, calls } = setup(() => ({
      json: async () => ({ versions: [{ text: 'v1' }] }),
    }));
    await expect(
      client.listCommentVersions('board-1', 'item-1', 'comment-1'),
    ).resolves.toEqual([{ text: 'v1' }]);
    await expect(
      client.listDescriptionVersions('board-1', 'item-1'),
    ).resolves.toEqual([{ text: 'v1' }]);
    expect(calls.map(call => call.url)).toEqual([
      'http://backstage/api/boards/boards/board-1/items/item-1/comments/comment-1/versions',
      'http://backstage/api/boards/boards/board-1/items/item-1/description/versions',
    ]);
  });
});

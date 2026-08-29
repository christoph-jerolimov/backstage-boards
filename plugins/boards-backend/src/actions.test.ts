import {
  BackstageCredentials,
  BackstagePrincipalTypes,
} from '@backstage/backend-plugin-api';
import { Knex } from 'knex';
import { z } from 'zod/v3';
import {
  ActionsOptions,
  BoardsActionsRegistry,
  registerActions,
  resolvePermissionEntry,
  resolvePriority,
  resolveStatus,
} from './actions';
import { NotAllowedError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { BoardsService } from './service/BoardsService';
import {
  createTestService,
  testLogger,
  testPermissionGuard,
} from './service/testUtils';

/** The principal shapes this harness hands out. */
type TestPrincipal =
  | { type: 'user'; userEntityRef: string }
  | { type: 'service'; subject: string };

function credentialsOf(principal: TestPrincipal): BackstageCredentials {
  return { $$type: '@backstage/BackstageCredentials', principal };
}

function testPrincipal(
  credentials: BackstageCredentials,
): TestPrincipal | undefined {
  const { principal } = credentials;
  if (typeof principal !== 'object' || principal === null) {
    return undefined;
  }
  if (
    'userEntityRef' in principal &&
    typeof principal.userEntityRef === 'string'
  ) {
    return { type: 'user', userEntityRef: principal.userEntityRef };
  }
  if ('subject' in principal && typeof principal.subject === 'string') {
    return { type: 'service', subject: principal.subject };
  }
  return undefined;
}

const auth: ActionsOptions['auth'] = {
  isPrincipal: <TType extends keyof BackstagePrincipalTypes>(
    credentials: BackstageCredentials,
    type: TType,
  ): credentials is BackstageCredentials<BackstagePrincipalTypes[TType]> =>
    testPrincipal(credentials)?.type === type,
};

const userInfo: ActionsOptions['userInfo'] = {
  getUserInfo: async credentials => {
    const principal = testPrincipal(credentials);
    if (principal?.type !== 'user') {
      throw new Error('not a user principal');
    }
    return {
      userEntityRef: principal.userEntityRef,
      ownershipEntityRefs: [principal.userEntityRef],
    };
  },
};

const aliceCredentials = credentialsOf({
  type: 'user',
  userEntityRef: 'user:default/alice',
});

const bobCredentials = credentialsOf({
  type: 'user',
  userEntityRef: 'user:default/bob',
});

const serviceCredentials = credentialsOf({
  type: 'service',
  subject: 'external:github-sync',
});

/**
 * A registered action with its schema types erased — the registry holds
 * actions of many shapes, so each one validates its own input and output
 * on the way through instead.
 */
type RegisteredAction = {
  name: string;
  run: (input: unknown, credentials: BackstageCredentials) => Promise<unknown>;
};

function createRegistry() {
  const actions = new Map<string, RegisteredAction>();
  const registry: BoardsActionsRegistry = {
    register(options) {
      const inputSchema = options.schema.input(z);
      const outputSchema = options.schema.output(z);
      actions.set(options.name, {
        name: options.name,
        run: async (input, credentials) => {
          const result: unknown = await options.action({
            input: inputSchema.parse(input),
            secrets: undefined,
            logger: testLogger,
            credentials,
          });
          const output =
            typeof result === 'object' && result !== null && 'output' in result
              ? result.output
              : undefined;
          return outputSchema.parse(output);
        },
      });
    },
  };
  return {
    registry,
    /**
     * Runs a registered action. Dispatch is by name, so the output shape is
     * not known statically — it is validated against the action's own output
     * schema before being read as `TOutput`.
     */
    invoke: async <TOutput>(
      name: string,
      input: unknown,
      credentials: BackstageCredentials,
    ): Promise<TOutput> => {
      const action = actions.get(name);
      if (!action) {
        throw new Error(`action ${name} not registered`);
      }
      return (await action.run(input, credentials)) as TOutput;
    },
    actions,
  };
}

/** The output shapes the tests below read. */
type BoardOutput = { id: string; name: string };
type IdOutput = { id: string };
type ItemsOutput = {
  items: Array<{ id: string; title: string; status: string }>;
};

describe('resolveStatus', () => {
  const board = {
    columns: [
      { id: 'c1', boardId: 'b', title: 'To do', position: 100 },
      { id: 'c2', boardId: 'b', title: 'Done', position: 200 },
      { id: 'c3', boardId: 'b', title: 'Done', position: 300 },
    ],
  };

  it('finds a column by trimmed title', () => {
    expect(resolveStatus(board, ' To do ').id).toBe('c1');
  });

  it('fails on an unknown title, listing the available ones', () => {
    expect(() => resolveStatus(board, 'Blocked')).toThrow(
      /Unknown status 'Blocked'; the board's statuses are: 'To do', 'Done', 'Done'/,
    );
  });

  it('fails on an ambiguous title', () => {
    expect(() => resolveStatus(board, 'Done')).toThrow(
      /Status 'Done' is ambiguous; 2 columns/,
    );
  });
});

describe('resolvePriority', () => {
  const board = {
    priorities: [
      { id: 'p1', boardId: 'b', name: 'high', order: 1 },
      { id: 'p2', boardId: 'b', name: 'low', order: 2 },
      { id: 'p3', boardId: 'b', name: 'low', order: 3 },
    ],
  };

  it('finds a priority by trimmed name', () => {
    expect(resolvePriority(board, ' high ').id).toBe('p1');
  });

  it('fails on an unknown name, listing the available ones', () => {
    expect(() => resolvePriority(board, 'urgent')).toThrow(
      /Unknown priority 'urgent'; the board's priorities are: 'high', 'low', 'low'/,
    );
  });

  it('fails on an ambiguous name', () => {
    expect(() => resolvePriority(board, 'low')).toThrow(
      /Priority 'low' is ambiguous; 2 priorities/,
    );
  });
});

describe('resolvePermissionEntry', () => {
  const principal = { type: 'anonymous' } as const;
  const entry = {
    id: 'e1',
    boardId: 'b',
    principalRef: 'user:default/jane',
    level: 'read' as const,
  };
  const service = { listPermissions: async () => [entry] };

  it('finds the entry for a principal ref', async () => {
    await expect(
      resolvePermissionEntry(service, principal, 'b', ' user:default/jane '),
    ).resolves.toEqual(entry);
  });

  it('fails when the principal has no entry', async () => {
    await expect(
      resolvePermissionEntry(service, principal, 'b', 'user:default/john'),
    ).rejects.toThrow(/No permission entry for 'user:default\/john'/);
  });
});

describe('actions', () => {
  let knex: Knex;
  let service: BoardsService;
  let registry: ReturnType<typeof createRegistry>;

  beforeEach(async () => {
    const testService = await createTestService();
    knex = testService.knex;
    service = testService.service;
    registry = createRegistry();
    registerActions({
      actionsRegistry: registry.registry,
      service,
      auth,
      userInfo,
      permissionGuard: testPermissionGuard(),
    });
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('list-items honors filters and permissions', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    await registry.invoke(
      'add-item',
      {
        boardId: board.id,
        status: 'To do',
        title: 'Tagged',
        tags: ['bug'],
      },
      aliceCredentials,
    );
    await registry.invoke(
      'add-item',
      { boardId: board.id, status: 'To do', title: 'Untagged' },
      aliceCredentials,
    );
    const listed = await registry.invoke<ItemsOutput>(
      'list-items',
      { boardId: board.id, tags: ['bug'] },
      aliceCredentials,
    );
    expect(listed.items.map(entry => entry.title)).toEqual(['Tagged']);
    expect(listed.items[0].status).toBe('To do');
    await expect(
      registry.invoke('list-items', { boardId: board.id }, bobCredentials),
    ).rejects.toThrow(/not found/);
  });

  it('items carry priorities as names through add, update, and list', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const priorities = await knex('board_priorities')
      .where('board_id', board.id)
      .orderBy('ord');
    const high = priorities[1];
    const added = await registry.invoke<IdOutput>(
      'add-item',
      {
        boardId: board.id,
        status: 'To do',
        title: 'Urgent',
        priority: 'critical',
      },
      aliceCredentials,
    );
    await registry.invoke(
      'add-item',
      { boardId: board.id, status: 'To do', title: 'Later' },
      aliceCredentials,
    );
    const listed = await registry.invoke<{
      items: Array<{ title: string; priority?: string }>;
    }>(
      'list-items',
      { boardId: board.id, priorities: ['critical'] },
      aliceCredentials,
    );
    expect(listed.items.map(entry => entry.title)).toEqual(['Urgent']);
    expect(listed.items[0].priority).toBe('critical');
    await registry.invoke(
      'update-item',
      { boardId: board.id, itemId: added.id, priority: 'high' },
      aliceCredentials,
    );
    const row = await knex('items').where('id', added.id).first();
    expect(row?.priority_id).toBe(high.id);
    await registry.invoke(
      'update-item',
      { boardId: board.id, itemId: added.id, priority: null },
      aliceCredentials,
    );
    const clearedRow = await knex('items').where('id', added.id).first();
    expect(clearedRow?.priority_id).toBeNull();
  });

  it('registers the full action set', () => {
    expect([...registry.actions.keys()].sort()).toEqual(
      [
        'create-board',
        'list-items',
        'update-board',
        'delete-board',
        'add-board-permission',
        'update-board-permission',
        'remove-board-permission',
        'add-item',
        'update-item',
        'move-item',
        'delete-item',
        'add-comment',
        'update-comment',
        'set-item-tags',
        'list-statuses',
        'list-priorities',
      ].sort(),
    );
  });

  it('create-board behaves like the UI path', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'Via Action' },
      aliceCredentials,
    );
    expect(board.id).toBeTruthy();
    const boards = await knex('boards');
    expect(boards).toHaveLength(1);
    const permissions = await knex('board_permissions');
    expect(permissions).toEqual([
      expect.objectContaining({
        principal_ref: 'user:default/alice',
        level: 'admin',
      }),
    ]);
  });

  it('actions enforce the same permission rules as the REST path', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    await expect(
      registry.invoke('delete-board', { boardId: board.id }, bobCredentials),
    ).rejects.toThrow(/not found/);
    await registry.invoke(
      'add-board-permission',
      { boardId: board.id, principalRef: 'user:default/bob', level: 'read' },
      aliceCredentials,
    );
    await expect(
      registry.invoke('delete-board', { boardId: board.id }, bobCredentials),
    ).rejects.toThrow(/requires 'admin'/);
  });

  it('item actions write the same change records as the service', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const item = await registry.invoke<IdOutput>(
      'add-item',
      { boardId: board.id, status: 'To do', title: 'Item' },
      aliceCredentials,
    );
    await registry.invoke(
      'update-item',
      { boardId: board.id, itemId: item.id, title: 'Renamed' },
      aliceCredentials,
    );
    const moved = await registry.invoke<{ id: string; status: string }>(
      'move-item',
      { boardId: board.id, itemId: item.id, status: 'In progress' },
      aliceCredentials,
    );
    expect(moved.status).toBe('In progress');
    await registry.invoke(
      'set-item-tags',
      { boardId: board.id, itemId: item.id, tags: ['infra'] },
      aliceCredentials,
    );
    const changes = await knex('changes').where('item_id', item.id);
    const types = changes.map(c => c.type).sort();
    expect(types).toEqual(['created', 'moved', 'updated', 'updated'].sort());
  });

  it('comment actions keep versions like the UI path', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const item = await registry.invoke<IdOutput>(
      'add-item',
      { boardId: board.id, status: 'To do', title: 'Item' },
      aliceCredentials,
    );
    const comment = await registry.invoke<IdOutput>(
      'add-comment',
      { boardId: board.id, itemId: item.id, text: 'v1' },
      aliceCredentials,
    );
    await registry.invoke(
      'update-comment',
      { boardId: board.id, itemId: item.id, commentId: comment.id, text: 'v2' },
      aliceCredentials,
    );
    const versions = await knex('comment_versions').where(
      'comment_id',
      comment.id,
    );
    expect(versions.map(v => v.text).sort()).toEqual(['v1', 'v2']);
  });

  it('fails add-item and move-item on an unknown status without changing anything', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    await expect(
      registry.invoke(
        'add-item',
        { boardId: board.id, status: 'Nope', title: 'Item' },
        aliceCredentials,
      ),
    ).rejects.toThrow(
      /Unknown status 'Nope'; the board's statuses are: 'To do', 'In progress', 'Done'/,
    );
    await expect(knex('items')).resolves.toHaveLength(0);
    const item = await registry.invoke<IdOutput>(
      'add-item',
      { boardId: board.id, status: 'To do', title: 'Item' },
      aliceCredentials,
    );
    await expect(
      registry.invoke(
        'move-item',
        { boardId: board.id, itemId: item.id, status: 'Nope' },
        aliceCredentials,
      ),
    ).rejects.toThrow(/Unknown status 'Nope'/);
    const row = await knex('items').where('id', item.id).first();
    const todo = await knex('board_columns')
      .where({ board_id: board.id, title: 'To do' })
      .first();
    expect(row?.column_id).toBe(todo?.id);
  });

  it('fails add-item on an ambiguous status', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B', columns: ['Doing', 'Doing'] },
      aliceCredentials,
    );
    await expect(
      registry.invoke(
        'add-item',
        { boardId: board.id, status: 'Doing', title: 'Item' },
        aliceCredentials,
      ),
    ).rejects.toThrow(/Status 'Doing' is ambiguous/);
    await expect(knex('items')).resolves.toHaveLength(0);
  });

  it('fails on unknown priorities in add, update, and list', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    await expect(
      registry.invoke(
        'add-item',
        { boardId: board.id, status: 'To do', title: 'A', priority: 'urgent' },
        aliceCredentials,
      ),
    ).rejects.toThrow(
      /Unknown priority 'urgent'; the board's priorities are: 'critical', 'high', 'medium', 'low'/,
    );
    const item = await registry.invoke<IdOutput>(
      'add-item',
      { boardId: board.id, status: 'To do', title: 'A' },
      aliceCredentials,
    );
    await expect(
      registry.invoke(
        'update-item',
        { boardId: board.id, itemId: item.id, priority: 'urgent' },
        aliceCredentials,
      ),
    ).rejects.toThrow(/Unknown priority 'urgent'/);
    const row = await knex('items').where('id', item.id).first();
    expect(row?.priority_id).toBeNull();
    await expect(
      registry.invoke(
        'list-items',
        { boardId: board.id, priorities: ['urgent'] },
        aliceCredentials,
      ),
    ).rejects.toThrow(/Unknown priority 'urgent'/);
  });

  it('permission entries are addressed by principal ref', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    await registry.invoke(
      'add-board-permission',
      { boardId: board.id, principalRef: 'user:default/bob', level: 'read' },
      aliceCredentials,
    );
    await registry.invoke(
      'update-board-permission',
      { boardId: board.id, principalRef: 'user:default/bob', level: 'write' },
      aliceCredentials,
    );
    const updated = await knex('board_permissions').where(
      'principal_ref',
      'user:default/bob',
    );
    expect(updated).toEqual([expect.objectContaining({ level: 'write' })]);
    await expect(
      registry.invoke(
        'update-board-permission',
        {
          boardId: board.id,
          principalRef: 'user:default/carol',
          level: 'read',
        },
        aliceCredentials,
      ),
    ).rejects.toThrow(/No permission entry for 'user:default\/carol'/);
    await registry.invoke(
      'remove-board-permission',
      { boardId: board.id, principalRef: 'user:default/bob' },
      aliceCredentials,
    );
    await expect(
      knex('board_permissions').where('principal_ref', 'user:default/bob'),
    ).resolves.toHaveLength(0);
  });

  it('list-statuses and list-priorities expose names, order, and colors', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const statuses = await registry.invoke<{
      statuses: Array<{ title: string; color?: string; position: number }>;
    }>('list-statuses', { boardId: board.id }, aliceCredentials);
    expect(statuses.statuses).toEqual([
      { title: 'To do', position: 1 },
      { title: 'In progress', position: 2 },
      { title: 'Done', position: 3 },
    ]);
    const priorities = await registry.invoke<{
      priorities: Array<{ name: string; color?: string; order: number }>;
    }>('list-priorities', { boardId: board.id }, aliceCredentials);
    expect(priorities.priorities).toEqual([
      { name: 'critical', color: 'red', order: 1 },
      { name: 'high', color: 'orange', order: 2 },
      { name: 'medium', order: 3 },
      { name: 'low', order: 4 },
    ]);
    await expect(
      registry.invoke('list-statuses', { boardId: board.id }, bobCredentials),
    ).rejects.toThrow(/not found/);
    await expect(
      registry.invoke('list-priorities', { boardId: board.id }, bobCredentials),
    ).rejects.toThrow(/not found/);
  });

  it('service callers can create external read-only items via actions', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B', admins: ['user:default/alice'] },
      serviceCredentials,
    );
    const item = await registry.invoke<IdOutput>(
      'add-item',
      {
        boardId: board.id,
        status: 'To do',
        title: 'PR #1',
        externalManager: 'github',
      },
      serviceCredentials,
    );
    const rows = await knex('items').where('id', item.id);
    expect(rows[0].external_manager).toBe('github');
    await expect(
      registry.invoke(
        'update-item',
        { boardId: board.id, itemId: item.id, title: 'Nope' },
        aliceCredentials,
      ),
    ).rejects.toThrow(/read-only/);
  });
  it('denies every action without boards.use', async () => {
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );

    const denied = createRegistry();
    registerActions({
      actionsRegistry: denied.registry,
      service,
      auth,
      userInfo,
      permissionGuard: testPermissionGuard({
        'boards.use': AuthorizeResult.DENY,
      }),
    });

    await expect(
      denied.invoke('list-items', { boardId: board.id }, aliceCredentials),
    ).rejects.toThrow(NotAllowedError);
    await expect(
      denied.invoke(
        'update-board',
        { boardId: board.id, name: 'Nope' },
        aliceCredentials,
      ),
    ).rejects.toThrow(NotAllowedError);
    // nothing changed
    const boards = await knex('boards').where('id', board.id);
    expect(boards[0].name).toBe('B');
  });

  it('gates create-board on boards.new.create', async () => {
    const restricted = createRegistry();
    registerActions({
      actionsRegistry: restricted.registry,
      service,
      auth,
      userInfo,
      permissionGuard: testPermissionGuard({
        'boards.new.create': AuthorizeResult.DENY,
      }),
    });

    await expect(
      restricted.invoke('create-board', { name: 'Nope' }, aliceCredentials),
    ).rejects.toThrow(/boards\.new\.create/);
    expect(await knex('boards')).toHaveLength(0);

    // with only use granted, non-creating actions still work
    const board = await registry.invoke<BoardOutput>(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const updated = await restricted.invoke<IdOutput>(
      'update-board',
      { boardId: board.id, name: 'Renamed' },
      aliceCredentials,
    );
    expect(updated.id).toBe(board.id);
  });
});

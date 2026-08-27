import {
  AuthService,
  BackstageCredentials,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { Knex } from 'knex';
import { registerActions } from './actions';
import { BoardsService } from './service/BoardsService';
import { createTestService } from './service/testUtils';

const auth = {
  isPrincipal: (credentials: any, type: string) =>
    credentials.principal?.type === type,
} as unknown as AuthService;

const userInfo = {
  getUserInfo: async (credentials: any) => ({
    userEntityRef: credentials.principal.userEntityRef,
    ownershipEntityRefs: [credentials.principal.userEntityRef],
  }),
} as unknown as UserInfoService;

const aliceCredentials = {
  $$type: '@backstage/BackstageCredentials',
  principal: { type: 'user', userEntityRef: 'user:default/alice' },
} as unknown as BackstageCredentials;

const bobCredentials = {
  $$type: '@backstage/BackstageCredentials',
  principal: { type: 'user', userEntityRef: 'user:default/bob' },
} as unknown as BackstageCredentials;

const serviceCredentials = {
  $$type: '@backstage/BackstageCredentials',
  principal: { type: 'service', subject: 'external:github-sync' },
} as unknown as BackstageCredentials;

type RegisteredAction = {
  name: string;
  action: (ctx: {
    input: any;
    credentials: BackstageCredentials;
  }) => Promise<any>;
};

function createRegistry() {
  const actions = new Map<string, RegisteredAction>();
  return {
    registry: {
      register: (options: any) => {
        actions.set(options.name, options);
      },
    },
    invoke: async (
      name: string,
      input: any,
      credentials: BackstageCredentials,
    ) => {
      const action = actions.get(name);
      if (!action) {
        throw new Error(`action ${name} not registered`);
      }
      return action.action({ input, credentials } as any);
    },
    actions,
  };
}

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
      actionsRegistry: registry.registry as any,
      service,
      auth,
      userInfo,
    });
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('list-items honors filters and permissions', async () => {
    const { output: board } = await registry.invoke(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const columns = await knex('board_columns').where('board_id', board.id);
    await registry.invoke(
      'add-item',
      {
        boardId: board.id,
        columnId: columns[0].id,
        title: 'Tagged',
        tags: ['bug'],
      },
      aliceCredentials,
    );
    await registry.invoke(
      'add-item',
      { boardId: board.id, columnId: columns[0].id, title: 'Untagged' },
      aliceCredentials,
    );
    const { output } = await registry.invoke(
      'list-items',
      { boardId: board.id, tags: ['bug'] },
      aliceCredentials,
    );
    expect(output.items.map((i: any) => i.title)).toEqual(['Tagged']);
    await expect(
      registry.invoke('list-items', { boardId: board.id }, bobCredentials),
    ).rejects.toThrow(/not found/);
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
      ].sort(),
    );
  });

  it('create-board behaves like the UI path', async () => {
    const { output } = await registry.invoke(
      'create-board',
      { name: 'Via Action' },
      aliceCredentials,
    );
    expect(output.id).toBeTruthy();
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
    const { output: board } = await registry.invoke(
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
    const { output: board } = await registry.invoke(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const columns = await knex('board_columns').where('board_id', board.id);
    const { output: item } = await registry.invoke(
      'add-item',
      { boardId: board.id, columnId: columns[0].id, title: 'Item' },
      aliceCredentials,
    );
    await registry.invoke(
      'update-item',
      { boardId: board.id, itemId: item.id, title: 'Renamed' },
      aliceCredentials,
    );
    await registry.invoke(
      'move-item',
      { boardId: board.id, itemId: item.id, columnId: columns[1].id },
      aliceCredentials,
    );
    await registry.invoke(
      'set-item-tags',
      { boardId: board.id, itemId: item.id, tags: ['infra'] },
      aliceCredentials,
    );
    const changes = await knex('changes').where('item_id', item.id);
    const types = changes.map(c => c.type).sort();
    expect(types).toEqual(
      ['created', 'moved', 'updated', 'updated'].sort(),
    );
  });

  it('comment actions keep versions like the UI path', async () => {
    const { output: board } = await registry.invoke(
      'create-board',
      { name: 'B' },
      aliceCredentials,
    );
    const columns = await knex('board_columns').where('board_id', board.id);
    const { output: item } = await registry.invoke(
      'add-item',
      { boardId: board.id, columnId: columns[0].id, title: 'Item' },
      aliceCredentials,
    );
    const { output: comment } = await registry.invoke(
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

  it('service callers can create external read-only items via actions', async () => {
    const { output: board } = await registry.invoke(
      'create-board',
      { name: 'B', admins: ['user:default/alice'] },
      serviceCredentials,
    );
    const columns = await knex('board_columns').where('board_id', board.id);
    const { output: item } = await registry.invoke(
      'add-item',
      {
        boardId: board.id,
        columnId: columns[0].id,
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
});

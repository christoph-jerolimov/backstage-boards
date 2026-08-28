import {
  AuthService,
  BackstageCredentials,
  BackstagePrincipalTypes,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { AuthenticationError, NotAllowedError } from '@backstage/errors';
import express from 'express';
import request from 'supertest';
import { Knex } from 'knex';
import {
  BoardItem,
  BoardListEntry,
  BoardPermissionEntry,
  BoardWithContext,
  CommentVersion,
  ItemComment,
  MyBoardItem,
  TimelineEntry,
} from '@internal/plugin-boards-common';
import { createRouter, RouterHttpAuth } from './router';
import { BoardsService } from './service/BoardsService';
import { createTestService, alice, bob, testLogger } from './service/testUtils';

const USERS: Record<
  string,
  { userEntityRef: string; ownershipEntityRefs: string[] }
> = {
  alice: {
    userEntityRef: 'user:default/alice',
    ownershipEntityRefs: ['user:default/alice', 'group:default/team-a'],
  },
  bob: {
    userEntityRef: 'user:default/bob',
    ownershipEntityRefs: ['user:default/bob'],
  },
};

// Resolves credentials from the `x-test-user` / `x-test-service` headers so
// tests can act as different principals without a real auth setup. The
// `allow` option is honoured the way the real service does, so handlers
// restricting themselves to a principal type are covered.
/** The principal shapes this harness hands out, all in one union. */
type TestPrincipal =
  | { type: 'none' }
  | { type: 'user'; userEntityRef: string }
  | { type: 'service'; subject: string };

function testPrincipal(credentials: BackstageCredentials): TestPrincipal {
  const { principal } = credentials;
  if (typeof principal !== 'object' || principal === null) {
    return { type: 'none' };
  }
  // the harness only ever issues the shapes above, so recognising the
  // discriminant is enough to get back to the union
  if (
    'userEntityRef' in principal &&
    typeof principal.userEntityRef === 'string'
  ) {
    return { type: 'user', userEntityRef: principal.userEntityRef };
  }
  if ('subject' in principal && typeof principal.subject === 'string') {
    return { type: 'service', subject: principal.subject };
  }
  return { type: 'none' };
}

const httpAuth: RouterHttpAuth = {
  credentials: async (req, options) => {
    const user = req.header('x-test-user');
    const svc = req.header('x-test-service');
    let principal: TestPrincipal = { type: 'none' };
    if (user) {
      principal = { type: 'user', userEntityRef: USERS[user].userEntityRef };
    } else if (svc) {
      principal = { type: 'service', subject: svc };
    }
    if (!options.allow.includes(principal.type)) {
      // mirrors the real service: missing credentials are a 401, present but
      // disallowed ones a 403
      if (principal.type === 'none') {
        throw new AuthenticationError('Missing credentials');
      }
      throw new NotAllowedError(
        `This endpoint does not allow '${principal.type}' credentials`,
      );
    }
    return { $$type: '@backstage/BackstageCredentials', principal };
  },
};

const auth: Pick<AuthService, 'isPrincipal'> = {
  isPrincipal: <TType extends keyof BackstagePrincipalTypes>(
    credentials: BackstageCredentials,
    type: TType,
  ): credentials is BackstageCredentials<BackstagePrincipalTypes[TType]> =>
    testPrincipal(credentials).type === type,
};

const userInfo: Pick<UserInfoService, 'getUserInfo'> = {
  getUserInfo: async credentials => {
    const principal = testPrincipal(credentials);
    const ref = principal.type === 'user' ? principal.userEntityRef : undefined;
    const entry = Object.values(USERS).find(u => u.userEntityRef === ref);
    if (!entry) {
      throw new Error(`unknown user ${ref}`);
    }
    return entry;
  },
};

/**
 * The parsed JSON body of a response, read as the shape the route documents.
 * Supertest types every body as `any`, so this is the single place where the
 * wire format is given a type.
 */
function body<T>(response: { body: unknown }): T {
  return response.body as T;
}

// Maps thrown Backstage errors to statuses the way the backend framework's
// default error middleware does in production.
function errorMiddleware(): express.ErrorRequestHandler {
  return (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      {
        NotFoundError: 404,
        NotAllowedError: 403,
        AuthenticationError: 401,
        InputError: 400,
        ConflictError: 409,
      }[err.name as string] ?? 500;
    res
      .status(status)
      .json({ error: { name: err.name, message: err.message } });
  };
}

describe('createRouter', () => {
  let app: express.Express;
  let knex: Knex;
  let service: BoardsService;

  beforeEach(async () => {
    const testService = await createTestService();
    knex = testService.knex;
    service = testService.service;
    app = express();
    app.use(
      await createRouter({
        service,
        httpAuth,
        auth,
        userInfo,
        logger: testLogger,
      }),
    );
    app.use(errorMiddleware());
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('creates and fetches a board', async () => {
    const created = await request(app)
      .post('/boards')
      .set('x-test-user', 'alice')
      .send({ name: 'Team Alpha' })
      .expect(201);
    const board = body<BoardWithContext>(created);
    expect(board.name).toBe('Team Alpha');
    expect(board.access).toBe('admin');

    const fetched = await request(app)
      .get(`/boards/${board.id}`)
      .set('x-test-user', 'alice')
      .expect(200);
    expect(body<BoardWithContext>(fetched).columns.length).toBeGreaterThan(0);
  });

  it('lists exactly the current user’s items on GET /my-items', async () => {
    const board = body<BoardWithContext>(
      await request(app)
        .post('/boards')
        .set('x-test-user', 'alice')
        .send({ name: 'B', visibility: 'logged-in-write' })
        .expect(201),
    );
    const columnId = board.columns[0].id;
    // direct assignment to alice
    await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-user', 'alice')
      .send({ columnId, title: 'Direct', assignees: ['user:default/alice'] })
      .expect(201);
    // via alice's group
    await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-user', 'alice')
      .send({
        columnId,
        title: 'Via group',
        assignees: ['group:default/team-a'],
      })
      .expect(201);
    // someone else's item must not appear
    await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-user', 'alice')
      .send({ columnId, title: 'Bobs', assignees: ['user:default/bob'] })
      .expect(201);

    const mine = await request(app)
      .get('/my-items')
      .set('x-test-user', 'alice')
      .expect(200);
    const myItems = body<{ items: MyBoardItem[] }>(mine).items;
    expect(myItems.map(entry => entry.item.title).sort()).toEqual([
      'Direct',
      'Via group',
    ]);
    expect(myItems[0].boardName).toBe('B');

    const bobs = await request(app)
      .get('/my-items')
      .set('x-test-user', 'bob')
      .expect(200);
    expect(
      body<{ items: MyBoardItem[] }>(bobs).items.map(entry => entry.item.title),
    ).toEqual(['Bobs']);

    // anonymous callers are rejected
    await request(app).get('/my-items').expect(403);
  });

  it('rejects board creation without a name', async () => {
    await request(app)
      .post('/boards')
      .set('x-test-user', 'alice')
      .send({})
      .expect(400);
  });

  it('hides private boards from other users', async () => {
    const board = await service.createBoard(alice, { name: 'Secret' });
    await request(app)
      .get(`/boards/${board.id}`)
      .set('x-test-user', 'bob')
      .expect(404);
    const list = await request(app)
      .get('/boards')
      .set('x-test-user', 'bob')
      .expect(200);
    expect(body<{ boards: BoardListEntry[] }>(list).boards).toHaveLength(0);
  });

  it('rejects mutations from read-only users', async () => {
    const board = await service.createBoard(alice, {
      name: 'B',
      visibility: 'logged-in-read',
    });
    const columnId = (await service.getBoard(alice, board.id)).columns[0].id;
    await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-user', 'bob')
      .send({ columnId, title: 'Nope' })
      .expect(403);
    await request(app)
      .delete(`/boards/${board.id}`)
      .set('x-test-user', 'bob')
      .expect(403);
  });

  it('serves public-read boards without credentials, read-only', async () => {
    const board = await service.createBoard(alice, {
      name: 'Public',
      visibility: 'public-read',
    });
    const fetched = body<BoardWithContext>(
      await request(app).get(`/boards/${board.id}`).expect(200),
    );
    expect(fetched.access).toBe('read');
    const columnId = fetched.columns[0].id;
    await request(app)
      .post(`/boards/${board.id}/items`)
      .send({ columnId, title: 'Nope' })
      .expect(403);
  });

  it('allows anonymous writes on public-write boards, recorded as text:anonymous', async () => {
    const board = await service.createBoard(alice, {
      name: 'Open',
      visibility: 'public-write',
    });
    const columnId = (await service.getBoard(alice, board.id)).columns[0].id;
    const created = await request(app)
      .post(`/boards/${board.id}/items`)
      .send({ columnId, title: 'From anywhere' })
      .expect(201);
    expect(body<BoardItem>(created).createdBy).toBe('text:anonymous');
    // still no admin rights
    await request(app).delete(`/boards/${board.id}`).expect(403);
  });

  it('returns per-status counts only when asked for', async () => {
    const board = await service.createBoard(alice, {
      name: 'Counted',
      visibility: 'logged-in-read',
    });
    const [todo] = (await service.getBoard(alice, board.id)).columns;
    await service.createItem(alice, board.id, {
      columnId: todo.id,
      title: 'One',
    });

    const plain = await request(app)
      .get('/boards')
      .set('x-test-user', 'alice')
      .expect(200);
    const plainBoards = body<{ boards: BoardListEntry[] }>(plain).boards;
    expect(plainBoards[0].statusCounts).toBeUndefined();

    const counted = await request(app)
      .get('/boards?counts=true')
      .set('x-test-user', 'alice')
      .expect(200);
    const countedBoards = body<{ boards: BoardListEntry[] }>(counted).boards;
    expect(countedBoards[0].statusCounts).toEqual([
      { columnId: todo.id, title: todo.title, count: 1 },
      expect.objectContaining({ count: 0 }),
      expect.objectContaining({ count: 0 }),
    ]);

    // the flag changes nothing but the added field
    expect({ ...countedBoards[0], statusCounts: undefined }).toEqual({
      ...plainBoards[0],
      statusCounts: undefined,
    });
  });

  it('hides private boards from anonymous requests entirely', async () => {
    const board = await service.createBoard(alice, { name: 'Secret' });
    await request(app).get(`/boards/${board.id}`).expect(404);
    const list = await request(app).get('/boards').expect(200);
    expect(body<{ boards: BoardListEntry[] }>(list).boards).toHaveLength(0);
  });

  it('manages permissions over http with last-admin protection', async () => {
    const board = await service.createBoard(alice, { name: 'B' });
    const added = await request(app)
      .post(`/boards/${board.id}/permissions`)
      .set('x-test-user', 'alice')
      .send({ principalRef: 'user:default/bob', level: 'write' })
      .expect(201);
    // bob can now write
    const columnId = (await service.getBoard(alice, board.id)).columns[0].id;
    await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-user', 'bob')
      .send({ columnId, title: 'By bob' })
      .expect(201);
    // last admin cannot be removed
    const perms = await request(app)
      .get(`/boards/${board.id}/permissions`)
      .set('x-test-user', 'alice')
      .expect(200);
    const adminEntry = body<{ permissions: BoardPermissionEntry[] }>(
      perms,
    ).permissions.find(entry => entry.level === 'admin');
    await request(app)
      .delete(`/boards/${board.id}/permissions/${adminEntry?.id}`)
      .set('x-test-user', 'alice')
      .expect(409);
    // non-admins cannot manage permissions
    await request(app)
      .delete(
        `/boards/${board.id}/permissions/${
          body<BoardPermissionEntry>(added).id
        }`,
      )
      .set('x-test-user', 'bob')
      .expect(403);
  });

  it('supports item lifecycle, comments, timeline, watch and favorites', async () => {
    const board = await service.createBoard(alice, { name: 'B' });
    const columnId = (await service.getBoard(alice, board.id)).columns[0].id;
    const item = await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-user', 'alice')
      .send({ columnId, title: 'Item', tags: ['x'] })
      .expect(201);
    const itemId = body<BoardItem>(item).id;
    await request(app)
      .patch(`/boards/${board.id}/items/${itemId}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Renamed' })
      .expect(200);
    const comment = body<ItemComment>(
      await request(app)
        .post(`/boards/${board.id}/items/${itemId}/comments`)
        .set('x-test-user', 'alice')
        .send({ text: 'hello' })
        .expect(201),
    );
    await request(app)
      .patch(`/boards/${board.id}/items/${itemId}/comments/${comment.id}`)
      .set('x-test-user', 'alice')
      .send({ text: 'hello v2' })
      .expect(200);
    const versions = await request(app)
      .get(
        `/boards/${board.id}/items/${itemId}/comments/${comment.id}/versions`,
      )
      .set('x-test-user', 'alice')
      .expect(200);
    expect(
      body<{ versions: CommentVersion[] }>(versions).versions.map(
        version => version.text,
      ),
    ).toEqual(['hello', 'hello v2']);
    const timeline = await request(app)
      .get(`/boards/${board.id}/items/${itemId}/timeline`)
      .set('x-test-user', 'alice')
      .expect(200);
    expect(
      body<{ timeline: TimelineEntry[] }>(timeline).timeline.length,
    ).toBeGreaterThanOrEqual(3);
    await request(app)
      .put(`/boards/${board.id}/items/${itemId}/watch`)
      .set('x-test-user', 'alice')
      .expect(204);
    await request(app)
      .put(`/boards/${board.id}/favorite`)
      .set('x-test-user', 'alice')
      .expect(204);
    const favorites = await request(app)
      .get('/boards?favorites=true')
      .set('x-test-user', 'alice')
      .expect(200);
    expect(
      body<{ boards: BoardListEntry[] }>(favorites).boards.map(
        entry => entry.id,
      ),
    ).toEqual([board.id]);
  });

  it('lists watchers over http for readers only', async () => {
    const board = await service.createBoard(alice, {
      name: 'B',
      visibility: 'logged-in-read',
    });
    await request(app)
      .put(`/boards/${board.id}/watch`)
      .set('x-test-user', 'alice')
      .expect(204);
    const watchers = await request(app)
      .get(`/boards/${board.id}/watchers`)
      .set('x-test-user', 'bob')
      .expect(200);
    expect(body<{ watchers: string[] }>(watchers).watchers).toEqual([
      'user:default/alice',
    ]);
    // anonymous cannot read a logged-in board's watchers
    await request(app).get(`/boards/${board.id}/watchers`).expect(404);
  });

  it('lets service principals create external read-only items', async () => {
    const board = await service.createBoard(alice, { name: 'B' });
    const columnId = (await service.getBoard(alice, board.id)).columns[0].id;
    const created = await request(app)
      .post(`/boards/${board.id}/items`)
      .set('x-test-service', 'external:github-sync')
      .send({ columnId, title: 'PR #1', externalManager: 'github' })
      .expect(201);
    await request(app)
      .patch(`/boards/${board.id}/items/${body<BoardItem>(created).id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Nope' })
      .expect(403);
  });

  describe('GET /service/entity-references', () => {
    it('answers service callers regardless of who can read the board', async () => {
      // bob's private board is invisible to alice, but the entity is still
      // referenced — the answer exists for the catalog processor only.
      await service.createBoard(bob, {
        name: 'Private',
        entityRefs: ['component:default/payments'],
      });
      const referenced = await request(app)
        .get('/service/entity-references?entityRef=component:default/payments')
        .set('x-test-service', 'plugin:catalog')
        .expect(200);
      expect(referenced.body).toEqual({ referenced: true });

      const unreferenced = await request(app)
        .get('/service/entity-references?entityRef=component:default/other')
        .set('x-test-service', 'plugin:catalog')
        .expect(200);
      expect(unreferenced.body).toEqual({ referenced: false });
    });

    it('rejects logged-in users and unauthenticated callers', async () => {
      await service.createBoard(alice, {
        name: 'Board',
        entityRefs: ['component:default/payments'],
      });
      const asUser = await request(app)
        .get('/service/entity-references?entityRef=component:default/payments')
        .set('x-test-user', 'alice')
        .expect(403);
      expect(asUser.body).not.toHaveProperty('referenced');
      const anonymous = await request(app)
        .get('/service/entity-references?entityRef=component:default/payments')
        .expect(401);
      expect(anonymous.body).not.toHaveProperty('referenced');
    });

    it('requires an entityRef', async () => {
      await request(app)
        .get('/service/entity-references')
        .set('x-test-service', 'plugin:catalog')
        .expect(400);
    });
  });
});

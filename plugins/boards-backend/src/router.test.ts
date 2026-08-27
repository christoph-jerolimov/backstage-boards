import {
  AuthService,
  HttpAuthService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import request from 'supertest';
import { Knex } from 'knex';
import { createRouter } from './router';
import { BoardsService } from './service/BoardsService';
import { createTestService, alice } from './service/testUtils';

const USERS: Record<string, { userEntityRef: string; ownershipEntityRefs: string[] }> = {
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
// tests can act as different principals without a real auth setup.
const httpAuth = {
  credentials: async (req: express.Request) => {
    const user = req.header('x-test-user');
    if (user) {
      return { $$type: '@backstage/BackstageCredentials', principal: { type: 'user', userEntityRef: USERS[user].userEntityRef } };
    }
    const svc = req.header('x-test-service');
    if (svc) {
      return { $$type: '@backstage/BackstageCredentials', principal: { type: 'service', subject: svc } };
    }
    return { $$type: '@backstage/BackstageCredentials', principal: { type: 'none' } };
  },
} as unknown as HttpAuthService;

const auth = {
  isPrincipal: (credentials: any, type: string) =>
    credentials.principal?.type === type,
} as unknown as AuthService;

const userInfo = {
  getUserInfo: async (credentials: any) => {
    const ref = credentials.principal.userEntityRef as string;
    const entry = Object.values(USERS).find(u => u.userEntityRef === ref);
    if (!entry) {
      throw new Error(`unknown user ${ref}`);
    }
    return entry;
  },
} as unknown as UserInfoService;

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
        InputError: 400,
        ConflictError: 409,
      }[err.name as string] ?? 500;
    res.status(status).json({ error: { name: err.name, message: err.message } });
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
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: function c() {
        return this;
      },
    } as any;
    app = express();
    app.use(
      await createRouter({ service, httpAuth, auth, userInfo, logger }),
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
    expect(created.body.name).toBe('Team Alpha');
    expect(created.body.access).toBe('admin');

    const fetched = await request(app)
      .get(`/boards/${created.body.id}`)
      .set('x-test-user', 'alice')
      .expect(200);
    expect(fetched.body.columns.length).toBeGreaterThan(0);
  });

  it('lists exactly the current user’s items on GET /my-items', async () => {
    const board = (
      await request(app)
        .post('/boards')
        .set('x-test-user', 'alice')
        .send({ name: 'B', visibility: 'logged-in-write' })
        .expect(201)
    ).body;
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
      .send({ columnId, title: 'Via group', assignees: ['group:default/team-a'] })
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
    expect(mine.body.items.map((e: any) => e.item.title).sort()).toEqual([
      'Direct',
      'Via group',
    ]);
    expect(mine.body.items[0].boardName).toBe('B');

    const bobs = await request(app)
      .get('/my-items')
      .set('x-test-user', 'bob')
      .expect(200);
    expect(bobs.body.items.map((e: any) => e.item.title)).toEqual(['Bobs']);

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
    expect(list.body.boards).toHaveLength(0);
  });

  it('rejects mutations from read-only users', async () => {
    const board = await service.createBoard(alice, {
      name: 'B',
      visibility: 'logged-in-read',
    });
    const columnId = (
      await service.getBoard(alice, board.id)
    ).columns[0].id;
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
    const fetched = await request(app).get(`/boards/${board.id}`).expect(200);
    expect(fetched.body.access).toBe('read');
    const columnId = fetched.body.columns[0].id;
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
    expect(created.body.createdBy).toBe('text:anonymous');
    // still no admin rights
    await request(app).delete(`/boards/${board.id}`).expect(403);
  });

  it('hides private boards from anonymous requests entirely', async () => {
    const board = await service.createBoard(alice, { name: 'Secret' });
    await request(app).get(`/boards/${board.id}`).expect(404);
    const list = await request(app).get('/boards').expect(200);
    expect(list.body.boards).toHaveLength(0);
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
    const adminEntry = perms.body.permissions.find(
      (p: any) => p.level === 'admin',
    );
    await request(app)
      .delete(`/boards/${board.id}/permissions/${adminEntry.id}`)
      .set('x-test-user', 'alice')
      .expect(409);
    // non-admins cannot manage permissions
    await request(app)
      .delete(`/boards/${board.id}/permissions/${added.body.id}`)
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
    const itemId = item.body.id;
    await request(app)
      .patch(`/boards/${board.id}/items/${itemId}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Renamed' })
      .expect(200);
    const comment = await request(app)
      .post(`/boards/${board.id}/items/${itemId}/comments`)
      .set('x-test-user', 'alice')
      .send({ text: 'hello' })
      .expect(201);
    await request(app)
      .patch(`/boards/${board.id}/items/${itemId}/comments/${comment.body.id}`)
      .set('x-test-user', 'alice')
      .send({ text: 'hello v2' })
      .expect(200);
    const versions = await request(app)
      .get(
        `/boards/${board.id}/items/${itemId}/comments/${comment.body.id}/versions`,
      )
      .set('x-test-user', 'alice')
      .expect(200);
    expect(versions.body.versions.map((v: any) => v.text)).toEqual([
      'hello',
      'hello v2',
    ]);
    const timeline = await request(app)
      .get(`/boards/${board.id}/items/${itemId}/timeline`)
      .set('x-test-user', 'alice')
      .expect(200);
    expect(timeline.body.timeline.length).toBeGreaterThanOrEqual(3);
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
    expect(favorites.body.boards.map((b: any) => b.id)).toEqual([board.id]);
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
    expect(watchers.body.watchers).toEqual(['user:default/alice']);
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
      .patch(`/boards/${board.id}/items/${created.body.id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Nope' })
      .expect(403);
  });
});

import {
  AuthService,
  HttpAuthService,
  LoggerService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { Request } from 'express';
import { BoardsService } from './service/BoardsService';
import { BoardsPrincipal } from './service/access';

export interface RouterOptions {
  service: BoardsService;
  httpAuth: HttpAuthService;
  auth: AuthService;
  userInfo: UserInfoService;
  logger: LoggerService;
}

export async function resolvePrincipal(
  req: Request,
  options: {
    httpAuth: HttpAuthService;
    auth: AuthService;
    userInfo: UserInfoService;
  },
): Promise<BoardsPrincipal> {
  const credentials = await options.httpAuth.credentials(req, {
    allow: ['user', 'service', 'none'],
  });
  if (options.auth.isPrincipal(credentials, 'user')) {
    const info = await options.userInfo.getUserInfo(credentials);
    return {
      type: 'user',
      userRef: info.userEntityRef,
      ownershipRefs: info.ownershipEntityRefs,
    };
  }
  if (options.auth.isPrincipal(credentials, 'service')) {
    return { type: 'service', subject: credentials.principal.subject };
  }
  return { type: 'anonymous' };
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { service } = options;
  const router = Router();
  router.use(express.json());

  const principalOf = (req: Request) => resolvePrincipal(req, options);

  // ---- boards

  router.get('/boards', async (req, res) => {
    const principal = await principalOf(req);
    const boards = await service.listBoards(principal, {
      favoritesOnly: req.query.favorites === 'true',
      entityRef:
        typeof req.query.entityRef === 'string'
          ? req.query.entityRef
          : undefined,
    });
    res.json({ boards });
  });

  router.post('/boards', async (req, res) => {
    const principal = await principalOf(req);
    const board = await service.createBoard(principal, {
      name: req.body.name,
      columns: req.body.columns,
      entityRef: req.body.entityRef ?? undefined,
      visibility: req.body.visibility ?? undefined,
      admins: req.body.admins,
    });
    res.status(201).json(board);
  });

  router.get('/boards/:boardId', async (req, res) => {
    const principal = await principalOf(req);
    res.json(await service.getBoard(principal, req.params.boardId));
  });

  router.patch('/boards/:boardId', async (req, res) => {
    const principal = await principalOf(req);
    res.json(
      await service.updateBoard(principal, req.params.boardId, {
        name: req.body.name,
        entityRef: req.body.entityRef,
        visibility: req.body.visibility,
      }),
    );
  });

  router.delete('/boards/:boardId', async (req, res) => {
    const principal = await principalOf(req);
    await service.deleteBoard(principal, req.params.boardId);
    res.status(204).end();
  });

  router.put('/boards/:boardId/favorite', async (req, res) => {
    const principal = await principalOf(req);
    await service.setFavorite(principal, req.params.boardId, true);
    res.status(204).end();
  });

  router.delete('/boards/:boardId/favorite', async (req, res) => {
    const principal = await principalOf(req);
    await service.setFavorite(principal, req.params.boardId, false);
    res.status(204).end();
  });

  router.put('/boards/:boardId/watch', async (req, res) => {
    const principal = await principalOf(req);
    await service.setWatchBoard(principal, req.params.boardId, true);
    res.status(204).end();
  });

  router.delete('/boards/:boardId/watch', async (req, res) => {
    const principal = await principalOf(req);
    await service.setWatchBoard(principal, req.params.boardId, false);
    res.status(204).end();
  });

  router.get('/boards/:boardId/changes', async (req, res) => {
    const principal = await principalOf(req);
    res.json({
      changes: await service.getBoardChanges(principal, req.params.boardId, {
        limit:
          typeof req.query.limit === 'string'
            ? Number(req.query.limit)
            : undefined,
      }),
    });
  });

  router.get('/boards/:boardId/watchers', async (req, res) => {
    const principal = await principalOf(req);
    res.json({
      watchers: await service.listBoardWatchers(principal, req.params.boardId),
    });
  });

  // ---- permissions

  router.get('/boards/:boardId/permissions', async (req, res) => {
    const principal = await principalOf(req);
    res.json({
      permissions: await service.listPermissions(principal, req.params.boardId),
    });
  });

  router.post('/boards/:boardId/permissions', async (req, res) => {
    const principal = await principalOf(req);
    res.status(201).json(
      await service.addPermission(principal, req.params.boardId, {
        principalRef: req.body.principalRef,
        level: req.body.level,
      }),
    );
  });

  router.patch(
    '/boards/:boardId/permissions/:permissionId',
    async (req, res) => {
      const principal = await principalOf(req);
      res.json(
        await service.updatePermission(
          principal,
          req.params.boardId,
          req.params.permissionId,
          req.body.level,
        ),
      );
    },
  );

  router.delete(
    '/boards/:boardId/permissions/:permissionId',
    async (req, res) => {
      const principal = await principalOf(req);
      await service.removePermission(
        principal,
        req.params.boardId,
        req.params.permissionId,
      );
      res.status(204).end();
    },
  );

  // ---- columns

  router.post('/boards/:boardId/columns', async (req, res) => {
    const principal = await principalOf(req);
    res.status(201).json(
      await service.addColumn(principal, req.params.boardId, {
        title: req.body.title,
        position: req.body.position,
        color: req.body.color,
      }),
    );
  });

  router.patch('/boards/:boardId/columns/:columnId', async (req, res) => {
    const principal = await principalOf(req);
    res.json(
      await service.updateColumn(
        principal,
        req.params.boardId,
        req.params.columnId,
        {
          title: req.body.title,
          position: req.body.position,
          color: req.body.color,
        },
      ),
    );
  });

  router.delete('/boards/:boardId/columns/:columnId', async (req, res) => {
    const principal = await principalOf(req);
    await service.deleteColumn(
      principal,
      req.params.boardId,
      req.params.columnId,
      {
        moveItemsTo:
          typeof req.query.moveItemsTo === 'string'
            ? req.query.moveItemsTo
            : undefined,
      },
    );
    res.status(204).end();
  });

  // ---- items

  router.get('/boards/:boardId/items', async (req, res) => {
    const principal = await principalOf(req);
    const asArray = (value: unknown): string[] => {
      if (typeof value === 'string') {
        return [value];
      }
      return Array.isArray(value) ? (value as string[]) : [];
    };
    const labels: Record<string, string> = {};
    for (const pair of asArray(req.query.label)) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        labels[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
    res.json({
      items: await service.listItems(principal, req.params.boardId, {
        text: typeof req.query.text === 'string' ? req.query.text : undefined,
        tags: asArray(req.query.tag),
        labels,
      }),
    });
  });

  router.get('/boards/:boardId/items/archived', async (req, res) => {
    const principal = await principalOf(req);
    res.json({
      items: await service.listArchivedItems(principal, req.params.boardId),
    });
  });

  router.post('/boards/:boardId/items/:itemId/restore', async (req, res) => {
    const principal = await principalOf(req);
    res.json(
      await service.restoreItem(
        principal,
        req.params.boardId,
        req.params.itemId,
      ),
    );
  });

  router.post('/boards/:boardId/items', async (req, res) => {
    const principal = await principalOf(req);
    if (!req.body.columnId) {
      throw new InputError('columnId is required');
    }
    res.status(201).json(
      await service.createItem(principal, req.params.boardId, {
        columnId: req.body.columnId,
        title: req.body.title,
        position: req.body.position,
        creatorRef: req.body.creatorRef,
        assignees: req.body.assignees,
        labels: req.body.labels,
        tags: req.body.tags,
        externalManager: req.body.externalManager,
      }),
    );
  });

  router.get('/boards/:boardId/items/:itemId', async (req, res) => {
    const principal = await principalOf(req);
    res.json(
      await service.getItem(principal, req.params.boardId, req.params.itemId),
    );
  });

  router.patch('/boards/:boardId/items/:itemId', async (req, res) => {
    const principal = await principalOf(req);
    res.json(
      await service.updateItem(
        principal,
        req.params.boardId,
        req.params.itemId,
        {
          title: req.body.title,
          creatorRef: req.body.creatorRef,
          description: req.body.description,
          assignees: req.body.assignees,
          labels: req.body.labels,
          tags: req.body.tags,
        },
      ),
    );
  });

  router.get(
    '/boards/:boardId/items/:itemId/description/versions',
    async (req, res) => {
      const principal = await principalOf(req);
      res.json({
        versions: await service.listDescriptionVersions(
          principal,
          req.params.boardId,
          req.params.itemId,
        ),
      });
    },
  );

  router.post('/boards/:boardId/items/:itemId/move', async (req, res) => {
    const principal = await principalOf(req);
    if (!req.body.columnId) {
      throw new InputError('columnId is required');
    }
    res.json(
      await service.moveItem(principal, req.params.boardId, req.params.itemId, {
        columnId: req.body.columnId,
        position: req.body.position,
      }),
    );
  });

  router.delete('/boards/:boardId/items/:itemId', async (req, res) => {
    const principal = await principalOf(req);
    await service.deleteItem(principal, req.params.boardId, req.params.itemId);
    res.status(204).end();
  });

  router.put('/boards/:boardId/items/:itemId/watch', async (req, res) => {
    const principal = await principalOf(req);
    await service.setWatchItem(
      principal,
      req.params.boardId,
      req.params.itemId,
      true,
    );
    res.status(204).end();
  });

  router.delete('/boards/:boardId/items/:itemId/watch', async (req, res) => {
    const principal = await principalOf(req);
    await service.setWatchItem(
      principal,
      req.params.boardId,
      req.params.itemId,
      false,
    );
    res.status(204).end();
  });

  router.get('/boards/:boardId/items/:itemId/watchers', async (req, res) => {
    const principal = await principalOf(req);
    res.json({
      watchers: await service.listItemWatchers(
        principal,
        req.params.boardId,
        req.params.itemId,
      ),
    });
  });

  // ---- comments and timeline

  router.post('/boards/:boardId/items/:itemId/comments', async (req, res) => {
    const principal = await principalOf(req);
    res.status(201).json(
      await service.addComment(
        principal,
        req.params.boardId,
        req.params.itemId,
        req.body.text,
      ),
    );
  });

  router.patch(
    '/boards/:boardId/items/:itemId/comments/:commentId',
    async (req, res) => {
      const principal = await principalOf(req);
      res.json(
        await service.updateComment(
          principal,
          req.params.boardId,
          req.params.itemId,
          req.params.commentId,
          req.body.text,
        ),
      );
    },
  );

  router.delete(
    '/boards/:boardId/items/:itemId/comments/:commentId',
    async (req, res) => {
      const principal = await principalOf(req);
      await service.deleteComment(
        principal,
        req.params.boardId,
        req.params.itemId,
        req.params.commentId,
      );
      res.status(204).end();
    },
  );

  router.get(
    '/boards/:boardId/items/:itemId/comments/:commentId/versions',
    async (req, res) => {
      const principal = await principalOf(req);
      res.json({
        versions: await service.listCommentVersions(
          principal,
          req.params.boardId,
          req.params.itemId,
          req.params.commentId,
        ),
      });
    },
  );

  router.get('/boards/:boardId/items/:itemId/timeline', async (req, res) => {
    const principal = await principalOf(req);
    res.json({
      timeline: await service.getTimeline(
        principal,
        req.params.boardId,
        req.params.itemId,
      ),
    });
  });

  return router;
}

import {
  AuthService,
  BackstageCredentials,
  LoggerService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { MAX_BOARD_PAGE_SIZE } from '@internal/plugin-boards-common';
import express from 'express';
import Router from 'express-promise-router';
import { Request } from 'express';
import { BoardsService } from './service/BoardsService';
import { BoardsPrincipal } from './service/access';

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * The credential lookup the router needs, spelled out concretely: the
 * `HttpAuthService` method is generic in its allowed principal types and no
 * stand-in can produce that return type, while every real implementation
 * satisfies this narrower shape.
 */
export type RouterHttpAuth = {
  credentials(
    req: Request,
    options: { allow: Array<'user' | 'service' | 'none'> },
  ): Promise<BackstageCredentials>;
};

export interface RouterOptions {
  service: BoardsService;
  httpAuth: RouterHttpAuth;
  auth: Pick<AuthService, 'isPrincipal'>;
  userInfo: Pick<UserInfoService, 'getUserInfo'>;
  logger: LoggerService;
}

/** A query parameter as a string, or undefined when it is absent or repeated. */
function stringParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * A paging query parameter. Absent is undefined — the listing is then
 * unpaged; anything that is not an integer within `bounds` is rejected
 * rather than silently ignored, so a typo in a page link cannot quietly
 * return the first page instead. A value beyond the upper bound is
 * clamped, so no request can ask for an unbounded response.
 */
function pageNumber(
  value: unknown,
  name: string,
  bounds: { min: number; max?: number },
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (Number.isNaN(parsed) || parsed < bounds.min) {
    throw new InputError(
      `${name} must be an integer of at least ${bounds.min}`,
    );
  }
  return bounds.max === undefined ? parsed : Math.min(parsed, bounds.max);
}

export async function resolvePrincipal(
  req: Request,
  options: Pick<RouterOptions, 'httpAuth' | 'auth' | 'userInfo'>,
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

  router.get('/my-items', async (req, res) => {
    const principal = await principalOf(req);
    res.json({ items: await service.listMyItems(principal) });
  });

  // ---- service-to-service

  // Answers whether any non-archived board references an entity, for the
  // catalog processor that labels referenced entities. Restricted to service
  // principals: the answer ignores board visibility, so exposing it to users
  // would leak the existence of boards they cannot read. The plugin's router
  // allows unauthenticated requests through (public boards), so this handler
  // has to demand service credentials itself.
  router.get('/service/entity-references', async (req, res) => {
    await options.httpAuth.credentials(req, { allow: ['service'] });
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== 'string' || !entityRef.trim()) {
      throw new InputError('entityRef is required');
    }
    res.json({ referenced: await service.isEntityReferenced(entityRef) });
  });

  // ---- boards

  // Registered before '/boards/:boardId', which would otherwise match
  // 'facets' as a board id and answer 404 for every caller.
  router.get('/boards/facets', async (req, res) => {
    const principal = await principalOf(req);
    res.json(await service.listFilterOptions(principal));
  });

  router.get('/boards', async (req, res) => {
    const principal = await principalOf(req);
    res.json(
      await service.listBoards(principal, {
        favoritesOnly: req.query.favorites === 'true',
        withCounts: req.query.counts === 'true',
        entityRef: stringParam(req.query.entityRef),
        search: stringParam(req.query.search),
        createdBy: stringParam(req.query.createdBy),
        limit: pageNumber(req.query.limit, 'limit', {
          min: 1,
          max: MAX_BOARD_PAGE_SIZE,
        }),
        offset: pageNumber(req.query.offset, 'offset', { min: 0 }),
      }),
    );
  });

  router.post('/boards', async (req, res) => {
    const principal = await principalOf(req);
    const board = await service.createBoard(principal, {
      name: req.body.name,
      columns: req.body.columns,
      entityRefs: req.body.entityRefs,
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
        entityRefs: req.body.entityRefs,
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

  router.post('/boards/:boardId/unarchive', async (req, res) => {
    const principal = await principalOf(req);
    await service.unarchiveBoard(principal, req.params.boardId);
    res.status(204).end();
  });

  router.post('/boards/:boardId/delete-now', async (req, res) => {
    const principal = await principalOf(req);
    await service.hardDeleteBoard(principal, req.params.boardId);
    res.status(204).end();
  });

  router.post('/boards/:boardId/duplicate', async (req, res) => {
    const principal = await principalOf(req);
    res.status(201).json(
      await service.duplicateBoard(principal, req.params.boardId, {
        name: req.body.name,
        copyColumns: !!req.body.copyColumns,
        copyItems: !!req.body.copyItems,
        copyEntities: !!req.body.copyEntities,
        copyPermissions: !!req.body.copyPermissions,
      }),
    );
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
    // express parses a repeated query parameter into an array whose entries
    // may themselves be nested objects, so only the strings are kept
    const asArray = (value: unknown): string[] => {
      if (typeof value === 'string') {
        return [value];
      }
      return Array.isArray(value) ? value.filter(isString) : [];
    };
    res.json({
      items: await service.listItems(principal, req.params.boardId, {
        text: typeof req.query.text === 'string' ? req.query.text : undefined,
        tags: asArray(req.query.tag),
        assignees: asArray(req.query.assignee),
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
          tags: req.body.tags,
          dueDate: req.body.dueDate,
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
    res
      .status(201)
      .json(
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

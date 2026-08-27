import {
  AuthService,
  BackstageCredentials,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { BoardsService } from './service/BoardsService';
import { BoardsPrincipal } from './service/access';

export interface ActionsOptions {
  actionsRegistry: ActionsRegistryService;
  service: BoardsService;
  auth: AuthService;
  userInfo: UserInfoService;
}

export async function credentialsToPrincipal(
  credentials: BackstageCredentials,
  options: { auth: AuthService; userInfo: UserInfoService },
): Promise<BoardsPrincipal> {
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

const LEVELS = ['read', 'write', 'admin'] as const;
const VISIBILITIES = [
  'private',
  'logged-in-read',
  'logged-in-write',
  'public-read',
  'public-write',
] as const;

export function registerActions(options: ActionsOptions): void {
  const { actionsRegistry, service } = options;
  const toPrincipal = (credentials: BackstageCredentials) =>
    credentialsToPrincipal(credentials, options);

  actionsRegistry.register({
    name: 'create-board',
    title: 'Create Board',
    description:
      'Creates a new board with optional columns, visibility, entity assignment, and admin grants.',
    schema: {
      input: z =>
        z.object({
          name: z.string().describe('Name of the board'),
          columns: z
            .array(z.string())
            .optional()
            .describe('Initial column titles, in order'),
          entityRef: z
            .string()
            .optional()
            .describe('Catalog entity ref to assign the board to'),
          visibility: z.enum(VISIBILITIES).optional(),
          admins: z
            .array(z.string())
            .optional()
            .describe('User/group entity refs granted admin access'),
        }),
      output: z => z.object({ id: z.string(), name: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const board = await service.createBoard(await toPrincipal(credentials), {
        name: input.name,
        columns: input.columns,
        entityRef: input.entityRef,
        visibility: input.visibility,
        admins: input.admins,
      });
      return { output: { id: board.id, name: board.name } };
    },
  });

  actionsRegistry.register({
    name: 'update-board',
    title: 'Update Board',
    description:
      "Updates a board's name, catalog entity assignment, or visibility.",
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          name: z.string().optional(),
          entityRef: z
            .string()
            .nullable()
            .optional()
            .describe('Entity ref to assign, or null to clear'),
          visibility: z.enum(VISIBILITIES).optional(),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const board = await service.updateBoard(
        await toPrincipal(credentials),
        input.boardId,
        {
          name: input.name,
          entityRef: input.entityRef,
          visibility: input.visibility,
        },
      );
      return { output: { id: board.id } };
    },
  });

  actionsRegistry.register({
    name: 'delete-board',
    title: 'Delete Board',
    description: 'Deletes a board and all of its items, comments, and history.',
    attributes: { destructive: true },
    schema: {
      input: z => z.object({ boardId: z.string() }),
      output: z => z.object({}),
    },
    action: async ({ input, credentials }) => {
      await service.deleteBoard(await toPrincipal(credentials), input.boardId);
      return { output: {} };
    },
  });

  actionsRegistry.register({
    name: 'add-board-permission',
    title: 'Add Board Permission',
    description:
      'Grants a user or group a permission level (read, write, admin) on a board.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          principalRef: z
            .string()
            .describe('User or group entity ref, e.g. user:default/jane'),
          level: z.enum(LEVELS),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const entry = await service.addPermission(
        await toPrincipal(credentials),
        input.boardId,
        { principalRef: input.principalRef, level: input.level },
      );
      return { output: { id: entry.id } };
    },
  });

  actionsRegistry.register({
    name: 'update-board-permission',
    title: 'Update Board Permission',
    description: 'Changes the level of an existing board permission entry.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          permissionId: z.string(),
          level: z.enum(LEVELS),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const entry = await service.updatePermission(
        await toPrincipal(credentials),
        input.boardId,
        input.permissionId,
        input.level,
      );
      return { output: { id: entry.id } };
    },
  });

  actionsRegistry.register({
    name: 'remove-board-permission',
    title: 'Remove Board Permission',
    description: 'Removes a permission entry from a board.',
    attributes: { destructive: true },
    schema: {
      input: z =>
        z.object({ boardId: z.string(), permissionId: z.string() }),
      output: z => z.object({}),
    },
    action: async ({ input, credentials }) => {
      await service.removePermission(
        await toPrincipal(credentials),
        input.boardId,
        input.permissionId,
      );
      return { output: {} };
    },
  });

  actionsRegistry.register({
    name: 'add-item',
    title: 'Add Board Item',
    description:
      'Adds an item to a board column. Service callers may mark items as externally managed (read-only for users).',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          columnId: z.string(),
          title: z.string(),
          creatorRef: z.string().optional(),
          assignees: z.array(z.string()).optional(),
          labels: z.record(z.string(), z.string()).optional(),
          tags: z.array(z.string()).optional(),
          externalManager: z
            .string()
            .optional()
            .describe(
              'Identifier of the external managing system, e.g. github',
            ),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const item = await service.createItem(
        await toPrincipal(credentials),
        input.boardId,
        {
          columnId: input.columnId,
          title: input.title,
          creatorRef: input.creatorRef,
          assignees: input.assignees,
          labels: input.labels,
          tags: input.tags,
          externalManager: input.externalManager,
        },
      );
      return { output: { id: item.id } };
    },
  });

  actionsRegistry.register({
    name: 'update-item',
    title: 'Update Board Item',
    description:
      "Updates an item's title, creator, or assignees.",
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          title: z.string().optional(),
          creatorRef: z.string().nullable().optional(),
          assignees: z.array(z.string()).optional(),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const item = await service.updateItem(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
        {
          title: input.title,
          creatorRef: input.creatorRef,
          assignees: input.assignees,
        },
      );
      return { output: { id: item.id } };
    },
  });

  actionsRegistry.register({
    name: 'move-item',
    title: 'Move Board Item',
    description: 'Moves an item to another column and/or position.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          columnId: z.string(),
          position: z.number().optional(),
        }),
      output: z => z.object({ id: z.string(), columnId: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const item = await service.moveItem(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
        { columnId: input.columnId, position: input.position },
      );
      return { output: { id: item.id, columnId: item.columnId } };
    },
  });

  actionsRegistry.register({
    name: 'delete-item',
    title: 'Delete Board Item',
    description: 'Deletes an item from a board.',
    attributes: { destructive: true },
    schema: {
      input: z => z.object({ boardId: z.string(), itemId: z.string() }),
      output: z => z.object({}),
    },
    action: async ({ input, credentials }) => {
      await service.deleteItem(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
      );
      return { output: {} };
    },
  });

  actionsRegistry.register({
    name: 'add-comment',
    title: 'Add Item Comment',
    description: 'Adds a comment to a board item.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          text: z.string(),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const comment = await service.addComment(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
        input.text,
      );
      return { output: { id: comment.id } };
    },
  });

  actionsRegistry.register({
    name: 'update-comment',
    title: 'Update Item Comment',
    description:
      'Edits an existing comment; the previous version is kept in the comment history.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          commentId: z.string(),
          text: z.string(),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const comment = await service.updateComment(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
        input.commentId,
        input.text,
      );
      return { output: { id: comment.id } };
    },
  });

  actionsRegistry.register({
    name: 'set-item-labels',
    title: 'Set Item Labels',
    description: 'Replaces the key-value labels of an item.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          labels: z.record(z.string(), z.string()),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const item = await service.updateItem(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
        { labels: input.labels },
      );
      return { output: { id: item.id } };
    },
  });

  actionsRegistry.register({
    name: 'set-item-tags',
    title: 'Set Item Tags',
    description: 'Replaces the tags of an item.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          tags: z.array(z.string()),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const item = await service.updateItem(
        await toPrincipal(credentials),
        input.boardId,
        input.itemId,
        { tags: input.tags },
      );
      return { output: { id: item.id } };
    },
  });
}

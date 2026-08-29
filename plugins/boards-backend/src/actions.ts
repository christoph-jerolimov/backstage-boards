import {
  AuthService,
  BackstageCredentials,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { ActionsRegistryActionOptions } from '@backstage/backend-plugin-api/alpha';
import { ConflictError, NotFoundError } from '@backstage/errors';
import {
  BoardColumn,
  BoardPermissionEntry,
  BoardPriority,
  BoardWithContext,
  RETENTION_DAYS,
} from '@internal/plugin-boards-common';
import { AnyZodObject } from 'zod/v3';
import { BoardsService } from './service/BoardsService';
import { BoardsPrincipal } from './service/access';
import { BoardsPermissionGuard } from './permissions';

/**
 * The registry surface these actions use: none of them declares secrets, so
 * the secrets type parameter is left at its default. Spelling the shape out
 * rather than taking `ActionsRegistryService` whole lets a test double stand
 * in without losing the schema types; the real service still satisfies it.
 */
export type BoardsActionsRegistry = {
  register<TInput extends AnyZodObject, TOutput extends AnyZodObject>(
    options: ActionsRegistryActionOptions<TInput, TOutput>,
  ): void;
};

export interface ActionsOptions {
  actionsRegistry: BoardsActionsRegistry;
  service: BoardsService;
  auth: Pick<AuthService, 'isPrincipal'>;
  userInfo: Pick<UserInfoService, 'getUserInfo'>;
  permissionGuard: BoardsPermissionGuard;
}

export async function credentialsToPrincipal(
  credentials: BackstageCredentials,
  options: Pick<ActionsOptions, 'auth' | 'userInfo'>,
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

/**
 * Resolves a status string (column title) to the board's column. External
 * callers never see column ids, so the match is on the trimmed title:
 * unknown titles fail listing the valid ones, and duplicated titles fail
 * as ambiguous rather than picking one.
 */
export function resolveStatus(
  board: Pick<BoardWithContext, 'columns'>,
  status: string,
): BoardColumn {
  const wanted = status.trim();
  const matches = board.columns.filter(column => column.title === wanted);
  if (matches.length === 0) {
    const available = board.columns
      .map(column => `'${column.title}'`)
      .join(', ');
    throw new NotFoundError(
      `Unknown status '${wanted}'; the board's statuses are: ${available}`,
    );
  }
  if (matches.length > 1) {
    throw new ConflictError(
      `Status '${wanted}' is ambiguous; ${matches.length} columns of this board share that title`,
    );
  }
  return matches[0];
}

/** Resolves a priority name to the board's priority, like {@link resolveStatus}. */
export function resolvePriority(
  board: Pick<BoardWithContext, 'priorities'>,
  priority: string,
): BoardPriority {
  const wanted = priority.trim();
  const matches = board.priorities.filter(entry => entry.name === wanted);
  if (matches.length === 0) {
    const available = board.priorities
      .map(entry => `'${entry.name}'`)
      .join(', ');
    throw new NotFoundError(
      `Unknown priority '${wanted}'; the board's priorities are: ${available}`,
    );
  }
  if (matches.length > 1) {
    throw new ConflictError(
      `Priority '${wanted}' is ambiguous; ${matches.length} priorities of this board share that name`,
    );
  }
  return matches[0];
}

/**
 * Resolves a user/group entity ref to the board's permission entry. Entries
 * are unique per principal on a board, so no ambiguity case exists here.
 */
export async function resolvePermissionEntry(
  service: Pick<BoardsService, 'listPermissions'>,
  principal: BoardsPrincipal,
  boardId: string,
  principalRef: string,
): Promise<BoardPermissionEntry> {
  const wanted = principalRef.trim();
  const entries = await service.listPermissions(principal, boardId);
  const entry = entries.find(candidate => candidate.principalRef === wanted);
  if (!entry) {
    throw new NotFoundError(
      `No permission entry for '${wanted}' on this board`,
    );
  }
  return entry;
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
  // Every action goes through here, so the actions door enforces the same
  // plugin-level framework permissions as the REST router: `boards.use` for
  // everything, plus `boards.new.create` where a new board comes into
  // existence.
  const toPrincipal = async (
    credentials: BackstageCredentials,
    access: 'use' | 'create' = 'use',
  ): Promise<BoardsPrincipal> => {
    if (access === 'create') {
      await options.permissionGuard.requireCreate(credentials);
    } else {
      await options.permissionGuard.requireUse(credentials);
    }
    return credentialsToPrincipal(credentials, options);
  };

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
          entityRefs: z
            .array(z.string())
            .optional()
            .describe('Catalog entity refs the board references'),
          visibility: z.enum(VISIBILITIES).optional(),
          admins: z
            .array(z.string())
            .optional()
            .describe('User/group entity refs granted admin access'),
        }),
      output: z => z.object({ id: z.string(), name: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const board = await service.createBoard(
        await toPrincipal(credentials, 'create'),
        {
          name: input.name,
          columns: input.columns,
          entityRefs: input.entityRefs,
          visibility: input.visibility,
          admins: input.admins,
        },
      );
      return { output: { id: board.id, name: board.name } };
    },
  });

  actionsRegistry.register({
    name: 'update-board',
    title: 'Update Board',
    description:
      "Updates a board's name, referenced catalog entities, or visibility.",
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          name: z.string().optional(),
          entityRefs: z
            .array(z.string())
            .optional()
            .describe('Replaces the full list of referenced entity refs'),
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
          entityRefs: input.entityRefs,
          visibility: input.visibility,
        },
      );
      return { output: { id: board.id } };
    },
  });

  actionsRegistry.register({
    name: 'delete-board',
    title: 'Delete Board',
    description: `Archives a board; it becomes read-only for admins and is permanently deleted after ${RETENTION_DAYS} days.`,
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
      output: z => z.object({ principalRef: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const entry = await service.addPermission(
        await toPrincipal(credentials),
        input.boardId,
        { principalRef: input.principalRef, level: input.level },
      );
      return { output: { principalRef: entry.principalRef } };
    },
  });

  actionsRegistry.register({
    name: 'update-board-permission',
    title: 'Update Board Permission',
    description:
      "Changes the level of a principal's existing board permission entry.",
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          principalRef: z
            .string()
            .describe('User or group entity ref, e.g. user:default/jane'),
          level: z.enum(LEVELS),
        }),
      output: z => z.object({ principalRef: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const principal = await toPrincipal(credentials);
      const entry = await resolvePermissionEntry(
        service,
        principal,
        input.boardId,
        input.principalRef,
      );
      const updated = await service.updatePermission(
        principal,
        input.boardId,
        entry.id,
        input.level,
      );
      return { output: { principalRef: updated.principalRef } };
    },
  });

  actionsRegistry.register({
    name: 'remove-board-permission',
    title: 'Remove Board Permission',
    description: "Removes a principal's permission entry from a board.",
    attributes: { destructive: true },
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          principalRef: z
            .string()
            .describe('User or group entity ref, e.g. user:default/jane'),
        }),
      output: z => z.object({}),
    },
    action: async ({ input, credentials }) => {
      const principal = await toPrincipal(credentials);
      const entry = await resolvePermissionEntry(
        service,
        principal,
        input.boardId,
        input.principalRef,
      );
      await service.removePermission(principal, input.boardId, entry.id);
      return { output: {} };
    },
  });

  actionsRegistry.register({
    name: 'list-items',
    title: 'List Board Items',
    description:
      'Lists the items of a board, optionally filtered by text and tags (all must match).',
    attributes: { readOnly: true },
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          text: z.string().optional(),
          tags: z.array(z.string()).optional(),
          priorities: z
            .array(z.string())
            .optional()
            .describe(
              'Priority names; items matching any of them are returned',
            ),
        }),
      output: z =>
        z.object({
          items: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              status: z.string().describe('Title of the column the item is in'),
              tags: z.array(z.string()),
              assignees: z.array(z.string()),
              priority: z.string().optional().describe('Priority name'),
            }),
          ),
        }),
    },
    action: async ({ input, credentials }) => {
      const principal = await toPrincipal(credentials);
      const board = await service.getBoard(principal, input.boardId);
      const priorities = input.priorities?.map(
        name => resolvePriority(board, name).id,
      );
      const items = await service.listItems(principal, input.boardId, {
        text: input.text,
        tags: input.tags,
        priorities,
      });
      const statusById = new Map(board.columns.map(c => [c.id, c.title]));
      const priorityById = new Map(board.priorities.map(p => [p.id, p.name]));
      return {
        output: {
          items: items.map(item => ({
            id: item.id,
            title: item.title,
            status: statusById.get(item.columnId) ?? '',
            tags: item.tags,
            assignees: item.assignees,
            priority: item.priorityId
              ? priorityById.get(item.priorityId)
              : undefined,
          })),
        },
      };
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
          status: z
            .string()
            .describe("Title of one of the board's columns, e.g. 'To do'"),
          title: z.string(),
          creatorRef: z.string().optional(),
          assignees: z.array(z.string()).optional(),
          tags: z.array(z.string()).optional(),
          priority: z
            .string()
            .optional()
            .describe("Name of one of the board's priorities"),
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
      const principal = await toPrincipal(credentials);
      const board = await service.getBoard(principal, input.boardId);
      const column = resolveStatus(board, input.status);
      const priorityId =
        input.priority === undefined
          ? undefined
          : resolvePriority(board, input.priority).id;
      const item = await service.createItem(principal, input.boardId, {
        columnId: column.id,
        title: input.title,
        creatorRef: input.creatorRef,
        assignees: input.assignees,
        tags: input.tags,
        priorityId,
        externalManager: input.externalManager,
      });
      return { output: { id: item.id } };
    },
  });

  actionsRegistry.register({
    name: 'update-item',
    title: 'Update Board Item',
    description:
      "Updates an item's title, description, creator, assignees, due date, or priority.",
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          title: z.string().optional(),
          description: z
            .string()
            .optional()
            .describe('Markdown description; empty string clears it'),
          creatorRef: z.string().nullable().optional(),
          assignees: z.array(z.string()).optional(),
          dueDate: z
            .string()
            .nullable()
            .optional()
            .describe('Due date as YYYY-MM-DD, or null to clear it'),
          priority: z
            .string()
            .nullable()
            .optional()
            .describe(
              "Name of one of the board's priorities, or null to clear it",
            ),
        }),
      output: z => z.object({ id: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const principal = await toPrincipal(credentials);
      let priorityId: string | null | undefined = input.priority;
      if (typeof input.priority === 'string') {
        const board = await service.getBoard(principal, input.boardId);
        priorityId = resolvePriority(board, input.priority).id;
      }
      const item = await service.updateItem(
        principal,
        input.boardId,
        input.itemId,
        {
          title: input.title,
          description: input.description,
          creatorRef: input.creatorRef,
          assignees: input.assignees,
          dueDate: input.dueDate,
          priorityId,
        },
      );
      return { output: { id: item.id } };
    },
  });

  actionsRegistry.register({
    name: 'move-item',
    title: 'Move Board Item',
    description: 'Moves an item to another status column and/or position.',
    schema: {
      input: z =>
        z.object({
          boardId: z.string(),
          itemId: z.string(),
          status: z
            .string()
            .describe("Title of one of the board's columns, e.g. 'Done'"),
          position: z.number().optional(),
        }),
      output: z => z.object({ id: z.string(), status: z.string() }),
    },
    action: async ({ input, credentials }) => {
      const principal = await toPrincipal(credentials);
      const board = await service.getBoard(principal, input.boardId);
      const column = resolveStatus(board, input.status);
      const item = await service.moveItem(
        principal,
        input.boardId,
        input.itemId,
        {
          columnId: column.id,
          position: input.position,
        },
      );
      return { output: { id: item.id, status: column.title } };
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

  actionsRegistry.register({
    name: 'list-statuses',
    title: 'List Board Statuses',
    description:
      "Lists a board's status columns in board order; their titles are the valid `status` values for the item actions.",
    attributes: { readOnly: true },
    schema: {
      input: z => z.object({ boardId: z.string() }),
      output: z =>
        z.object({
          statuses: z.array(
            z.object({
              title: z.string(),
              color: z.string().optional(),
              position: z.number().describe('1-based position on the board'),
            }),
          ),
        }),
    },
    action: async ({ input, credentials }) => {
      const board = await service.getBoard(
        await toPrincipal(credentials),
        input.boardId,
      );
      return {
        output: {
          statuses: board.columns.map((column, index) => ({
            title: column.title,
            color: column.color,
            position: index + 1,
          })),
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'list-priorities',
    title: 'List Board Priorities',
    description:
      "Lists a board's priorities ordered from highest to lowest; their names are the valid `priority` values for the item actions.",
    attributes: { readOnly: true },
    schema: {
      input: z => z.object({ boardId: z.string() }),
      output: z =>
        z.object({
          priorities: z.array(
            z.object({
              name: z.string(),
              color: z.string().optional(),
              order: z.number().describe('1-based order; 1 is the highest'),
            }),
          ),
        }),
    },
    action: async ({ input, credentials }) => {
      const board = await service.getBoard(
        await toPrincipal(credentials),
        input.boardId,
      );
      return {
        output: {
          priorities: board.priorities.map(entry => ({
            name: entry.name,
            color: entry.color,
            order: entry.order,
          })),
        },
      };
    },
  });
}

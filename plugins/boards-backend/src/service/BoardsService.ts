import { LoggerService } from '@backstage/backend-plugin-api';
import {
  ConflictError,
  InputError,
  NotAllowedError,
  NotFoundError,
} from '@backstage/errors';
import { NotificationService } from '@backstage/plugin-notifications-node';
import { SignalsService } from '@backstage/plugin-signals-node';
import {
  Board,
  BoardChangeEntry,
  BoardColumn,
  COLUMN_COLORS,
  ColumnColor,
  BoardItem,
  BoardListEntry,
  BoardPermissionEntry,
  BoardPermissionLevel,
  BoardUpdate,
  BoardVisibility,
  BoardWithContext,
  ChangeRecord,
  CommentVersion,
  ItemComment,
  ItemFilter,
  ItemUpdate,
  MyBoardItem,
  NewItem,
  TimelineEntry,
  ALL_VISIBILITIES,
  extractMentions,
  isTextRef,
  isValidActorRef,
  isValidDueDate,
  isValidEntityRef,
  normalizeTags,
  isValidPrincipalRef,
  levelIncludes,
} from '@internal/plugin-boards-common';
import { Knex } from 'knex';
import { randomUUID as uuid } from 'crypto';
import {
  BoardsPrincipal,
  actorRef,
  computeEffectiveLevel,
} from './access';

const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done'];
const POSITION_STEP = 1000;

type BoardRow = {
  id: string;
  name: string;
  visibility: BoardVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

type ColumnRow = {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: string | null;
};

type PermissionRow = {
  id: string;
  board_id: string;
  principal_ref: string;
  level: BoardPermissionLevel;
};

type ItemRow = {
  id: string;
  board_id: string;
  column_id: string;
  position: number;
  title: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  creator_ref: string | null;
  external_manager: string | null;
  description: string | null;
  archived_at: string | null;
  archived_by: string | null;
  due_date: string | null;
};

type ChangeRow = {
  id: string;
  item_id: string;
  board_id: string;
  actor_ref: string;
  at: string;
  type: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
};

function now(): string {
  return new Date().toISOString();
}

/** Validates and dedupes a list of catalog entity refs. */
function normalizeEntityRefs(refs: string[]): string[] {
  const result = [...new Set(refs.map(ref => ref.trim()).filter(Boolean))];
  for (const ref of result) {
    if (!isValidEntityRef(ref)) {
      throw new InputError(`Invalid entity ref '${ref}'`);
    }
  }
  return result;
}

function toBoard(row: BoardRow, entityRefs: string[]): Board {
  return {
    id: row.id,
    name: row.name,
    entityRefs,
    visibility: row.visibility,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
  };
}

function toColumn(row: ColumnRow): BoardColumn {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    position: row.position,
    color: (row.color as ColumnColor) ?? undefined,
  };
}

function assertColumnColor(color: string): asserts color is ColumnColor {
  if (!Object.keys(COLUMN_COLORS).includes(color)) {
    throw new InputError(`Invalid column color '${color}'`);
  }
}

function toPermission(row: PermissionRow): BoardPermissionEntry {
  return {
    id: row.id,
    boardId: row.board_id,
    principalRef: row.principal_ref,
    level: row.level,
  };
}

function toChange(row: ChangeRow): ChangeRecord {
  return {
    id: row.id,
    itemId: row.item_id,
    boardId: row.board_id,
    actorRef: row.actor_ref,
    at: row.at,
    type: row.type as ChangeRecord['type'],
    field: row.field ?? undefined,
    oldValue: row.old_value === null ? undefined : JSON.parse(row.old_value),
    newValue: row.new_value === null ? undefined : JSON.parse(row.new_value),
  };
}

export interface BoardsServiceOptions {
  knex: Knex;
  logger: LoggerService;
  notifications?: NotificationService;
  signals?: SignalsService;
  /** Base path used in notification links, e.g. `/boards`. */
  appLinkBase?: string;
}

export class BoardsService {
  private readonly knex: Knex;
  private readonly logger: LoggerService;
  private readonly notifications?: NotificationService;
  private readonly signals?: SignalsService;
  private readonly appLinkBase: string;

  constructor(options: BoardsServiceOptions) {
    this.knex = options.knex;
    this.logger = options.logger;
    this.notifications = options.notifications;
    this.signals = options.signals;
    this.appLinkBase = options.appLinkBase ?? '/boards';
  }

  /**
   * Broadcasts that a board changed. The message carries ids only; all
   * data reads stay behind the permission-checked API.
   */
  private async emitBoardSignal(
    boardId: string,
    itemId?: string,
  ): Promise<void> {
    if (!this.signals) {
      return;
    }
    try {
      await this.signals.publish({
        recipients: { type: 'broadcast' },
        channel: 'boards',
        message: itemId ? { boardId, itemId } : { boardId },
      });
    } catch (error) {
      this.logger.warn(`Failed to publish board signal: ${error}`);
    }
  }

  // ---------------------------------------------------------------- access

  private async permissionRows(boardId: string): Promise<PermissionRow[]> {
    return this.knex<PermissionRow>('board_permissions').where(
      'board_id',
      boardId,
    );
  }

  private async effectiveLevel(
    principal: BoardsPrincipal,
    board: BoardRow,
  ): Promise<BoardPermissionLevel | undefined> {
    const entries = (await this.permissionRows(board.id)).map(row => ({
      principalRef: row.principal_ref,
      level: row.level,
    }));
    return computeEffectiveLevel({
      principal,
      visibility: board.visibility,
      entries,
    });
  }

  /**
   * Loads a board and asserts the principal has at least the required
   * level. Boards the principal cannot read at all surface as not-found.
   */
  private async requireBoard(
    principal: BoardsPrincipal,
    boardId: string,
    required: BoardPermissionLevel,
  ): Promise<{ board: BoardRow; level: BoardPermissionLevel }> {
    const board = await this.knex<BoardRow>('boards')
      .where('id', boardId)
      .first();
    if (!board) {
      throw new NotFoundError(`Board ${boardId} not found`);
    }
    const level = await this.effectiveLevel(principal, board);
    if (!level) {
      throw new NotFoundError(`Board ${boardId} not found`);
    }
    if (board.archived_at) {
      // archived boards: admins may read via the direct link, nobody writes
      if (!levelIncludes(level, 'admin')) {
        throw new NotFoundError(`Board ${boardId} not found`);
      }
      if (required !== 'read') {
        throw new ConflictError(
          'Board is archived and read-only until it is permanently deleted',
        );
      }
      return { board, level };
    }
    if (!levelIncludes(level, required)) {
      throw new NotAllowedError(
        `This operation requires '${required}' access to the board`,
      );
    }
    return { board, level };
  }

  private requireUserRef(principal: BoardsPrincipal): string {
    if (principal.type !== 'user') {
      throw new NotAllowedError('This operation requires a logged-in user');
    }
    return principal.userRef;
  }

  // ---------------------------------------------------------------- boards

  async createBoard(
    principal: BoardsPrincipal,
    options: {
      name: string;
      columns?: string[];
      entityRefs?: string[];
      visibility?: BoardVisibility;
      /** Additional admin grants, mainly for service callers. */
      admins?: string[];
    },
  ): Promise<BoardWithContext> {
    if (principal.type === 'anonymous') {
      throw new NotAllowedError('Creating a board requires authentication');
    }
    const name = options.name?.trim();
    if (!name) {
      throw new InputError('Board name must not be empty');
    }
    if (options.visibility && !ALL_VISIBILITIES.includes(options.visibility)) {
      throw new InputError(`Invalid visibility '${options.visibility}'`);
    }
    const entityRefs = normalizeEntityRefs(options.entityRefs ?? []);

    const boardId = uuid();
    const timestamp = now();
    const creator = actorRef(principal);
    const columnTitles =
      options.columns && options.columns.length > 0
        ? options.columns
        : DEFAULT_COLUMNS;

    await this.knex.transaction(async trx => {
      await trx<BoardRow>('boards').insert({
        id: boardId,
        name,
        visibility: options.visibility ?? 'private',
        created_by: creator,
        created_at: timestamp,
        updated_at: timestamp,
      });
      if (entityRefs.length > 0) {
        await trx('board_entities').insert(
          entityRefs.map(ref => ({ board_id: boardId, entity_ref: ref })),
        );
      }
      await trx<ColumnRow>('board_columns').insert(
        columnTitles.map((title, index) => ({
          id: uuid(),
          board_id: boardId,
          title,
          position: (index + 1) * POSITION_STEP,
          color: null,
        })),
      );
      const adminRefs = new Set<string>(options.admins ?? []);
      if (principal.type === 'user') {
        adminRefs.add(principal.userRef);
      }
      for (const ref of adminRefs) {
        if (!isValidPrincipalRef(ref)) {
          throw new InputError(
            `Invalid principal '${ref}', expected a user or group entity ref`,
          );
        }
      }
      if (adminRefs.size > 0) {
        await trx<PermissionRow>('board_permissions').insert(
          [...adminRefs].map(ref => ({
            id: uuid(),
            board_id: boardId,
            principal_ref: ref,
            level: 'admin' as const,
          })),
        );
      }
    });

    return this.getBoard(principal, boardId);
  }

  async getBoard(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<BoardWithContext> {
    const { board, level } = await this.requireBoard(principal, boardId, 'read');
    const columns = await this.knex<ColumnRow>('board_columns')
      .where('board_id', boardId)
      .orderBy('position');
    const userRef = principal.type === 'user' ? principal.userRef : undefined;
    const favorite = userRef
      ? !!(await this.knex('favorites')
          .where({ user_ref: userRef, board_id: boardId })
          .first())
      : false;
    const watching = userRef
      ? !!(await this.knex('watches')
          .where({
            user_ref: userRef,
            target_type: 'board',
            target_id: boardId,
          })
          .first())
      : false;
    const entityRefs = (await this.entityRefsByBoard([boardId])).get(
      boardId,
    ) ?? [];
    return {
      ...toBoard(board, entityRefs),
      columns: columns.map(toColumn),
      access: level,
      favorite,
      watching,
    };
  }

  /** Batch-loads the referenced entity refs for a set of boards. */
  private async entityRefsByBoard(
    boardIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (boardIds.length === 0) {
      return map;
    }
    const rows = await this.knex('board_entities')
      .whereIn('board_id', boardIds)
      .orderBy('entity_ref')
      .select('board_id', 'entity_ref');
    for (const row of rows) {
      map.set(row.board_id, [...(map.get(row.board_id) ?? []), row.entity_ref]);
    }
    return map;
  }

  async listBoards(
    principal: BoardsPrincipal,
    options?: { favoritesOnly?: boolean; entityRef?: string },
  ): Promise<BoardListEntry[]> {
    const query = this.knex<BoardRow>('boards')
      .whereNull('archived_at')
      .orderBy('name');
    if (options?.entityRef) {
      const entityRef = options.entityRef;
      query.whereExists(function entityMatch() {
        this.select('*')
          .from('board_entities')
          .whereRaw('board_entities.board_id = boards.id')
          .where('board_entities.entity_ref', entityRef);
      });
    }
    const rows = await query;
    const refsByBoard = await this.entityRefsByBoard(rows.map(row => row.id));
    const userRef = principal.type === 'user' ? principal.userRef : undefined;
    const favoriteIds = new Set<string>(
      userRef
        ? (
            await this.knex('favorites')
              .where('user_ref', userRef)
              .select('board_id')
          ).map(row => row.board_id)
        : [],
    );

    const result: BoardListEntry[] = [];
    for (const row of rows) {
      const level = await this.effectiveLevel(principal, row);
      if (!level) {
        continue;
      }
      if (options?.favoritesOnly && !favoriteIds.has(row.id)) {
        continue;
      }
      result.push({
        ...toBoard(row, refsByBoard.get(row.id) ?? []),
        access: level,
        favorite: favoriteIds.has(row.id),
      });
    }
    return result;
  }

  async updateBoard(
    principal: BoardsPrincipal,
    boardId: string,
    update: BoardUpdate,
  ): Promise<BoardWithContext> {
    await this.requireBoard(principal, boardId, 'admin');
    const patch: Partial<BoardRow> = { updated_at: now() };
    if (update.name !== undefined) {
      const name = update.name.trim();
      if (!name) {
        throw new InputError('Board name must not be empty');
      }
      patch.name = name;
    }
    if (update.entityRefs !== undefined) {
      const refs = normalizeEntityRefs(update.entityRefs);
      await this.knex.transaction(async trx => {
        await trx('board_entities').where('board_id', boardId).delete();
        if (refs.length > 0) {
          await trx('board_entities').insert(
            refs.map(ref => ({ board_id: boardId, entity_ref: ref })),
          );
        }
      });
    }
    if (update.visibility !== undefined) {
      if (!ALL_VISIBILITIES.includes(update.visibility)) {
        throw new InputError(`Invalid visibility '${update.visibility}'`);
      }
      patch.visibility = update.visibility;
    }
    await this.knex<BoardRow>('boards').where('id', boardId).update(patch);
    await this.emitBoardSignal(boardId);
    return this.getBoard(principal, boardId);
  }

  /** Archives a board; it stays reachable read-only for admins until purged. */
  async deleteBoard(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<void> {
    await this.requireBoard(principal, boardId, 'admin');
    await this.knex('boards').where('id', boardId).update({
      archived_at: now(),
      archived_by: actorRef(principal),
      updated_at: now(),
    });
    await this.emitBoardSignal(boardId);
  }

  /** Permanently deletes an archived board; the "delete now" escape hatch. */
  async hardDeleteBoard(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<void> {
    const { board } = await this.requireBoard(principal, boardId, 'read');
    const level = await this.effectiveLevel(principal, board);
    if (!levelIncludes(level, 'admin')) {
      throw new NotAllowedError('Deleting a board requires admin access');
    }
    if (!board.archived_at) {
      throw new ConflictError('Only archived boards can be deleted');
    }
    await this.cascadeDeleteBoards([boardId]);
    await this.emitBoardSignal(boardId);
  }

  private async cascadeDeleteBoards(boardIds: string[]): Promise<void> {
    if (boardIds.length === 0) {
      return;
    }
    await this.knex.transaction(async trx => {
      // changes/comments/items/columns/permissions/favorites cascade from FKs
      await trx('watches')
        .where('target_type', 'board')
        .whereIn('target_id', boardIds)
        .delete();
      const itemIds = (
        await trx('items').whereIn('board_id', boardIds).select('id')
      ).map(row => row.id);
      if (itemIds.length > 0) {
        await trx('watches')
          .where('target_type', 'item')
          .whereIn('target_id', itemIds)
          .delete();
      }
      await trx('boards').whereIn('id', boardIds).delete();
    });
  }

  /** Permanently removes boards archived before `olderThan`. */
  async purgeArchivedBoards(olderThan: Date): Promise<number> {
    const rows = await this.knex('boards')
      .whereNotNull('archived_at')
      .where('archived_at', '<', olderThan.toISOString())
      .select('id');
    const ids = rows.map(row => row.id as string);
    if (ids.length > 0) {
      await this.cascadeDeleteBoards(ids);
      this.logger.info(`Purged ${ids.length} archived boards`);
    }
    return ids.length;
  }

  async setFavorite(
    principal: BoardsPrincipal,
    boardId: string,
    favorite: boolean,
  ): Promise<void> {
    const userRef = this.requireUserRef(principal);
    await this.requireBoard(principal, boardId, 'read');
    await this.knex('favorites')
      .where({ user_ref: userRef, board_id: boardId })
      .delete();
    if (favorite) {
      await this.knex('favorites').insert({
        user_ref: userRef,
        board_id: boardId,
      });
    }
  }

  /**
   * Duplicates a board's structure (never its items). Share settings can
   * only be copied by admins of the source board.
   */
  async duplicateBoard(
    principal: BoardsPrincipal,
    boardId: string,
    options: {
      name?: string;
      copyColumns: boolean;
      copyItems?: boolean;
      copyEntities?: boolean;
      copyPermissions: boolean;
    },
  ): Promise<BoardWithContext> {
    const { board, level } = await this.requireBoard(principal, boardId, 'read');
    if (options.copyPermissions && !levelIncludes(level, 'admin')) {
      throw new NotAllowedError(
        'Copying share settings requires admin access to the source board',
      );
    }
    if (options.copyItems && !options.copyColumns) {
      throw new InputError('Items can only be copied together with columns');
    }
    if (principal.type === 'anonymous') {
      throw new NotAllowedError('Duplicating a board requires authentication');
    }
    const sourceColumns = await this.knex<ColumnRow>('board_columns')
      .where('board_id', boardId)
      .orderBy('position');
    const created = await this.createBoard(principal, {
      name: options.name?.trim() || `${board.name} (copy)`,
      columns: options.copyColumns
        ? sourceColumns.map(column => column.title)
        : undefined,
      entityRefs: options.copyEntities
        ? (await this.entityRefsByBoard([boardId])).get(boardId)
        : undefined,
      visibility: options.copyPermissions ? board.visibility : 'private',
    });
    if (options.copyColumns) {
      // carry over the colors, matching source order to created order
      const newColumns = await this.knex<ColumnRow>('board_columns')
        .where('board_id', created.id)
        .orderBy('position');
      for (let index = 0; index < newColumns.length; index += 1) {
        const color = sourceColumns[index]?.color ?? null;
        if (color) {
          await this.knex('board_columns')
            .where('id', newColumns[index].id)
            .update({ color });
        }
      }
      if (options.copyItems) {
        await this.copyItemsInto(
          principal,
          boardId,
          created.id,
          sourceColumns,
          newColumns,
        );
      }
    }
    if (options.copyPermissions) {
      const ownRefs = new Set(
        (await this.permissionRows(created.id)).map(row => row.principal_ref),
      );
      const sourcePermissions = await this.permissionRows(boardId);
      const clones = sourcePermissions.filter(
        row => !ownRefs.has(row.principal_ref),
      );
      if (clones.length > 0) {
        await this.knex('board_permissions').insert(
          clones.map(row => ({
            id: uuid(),
            board_id: created.id,
            principal_ref: row.principal_ref,
            // the duplicator is the copy's only admin; other admins of
            // the source become writers
            level: row.level === 'admin' ? 'write' : row.level,
          })),
        );
      }
    }
    return this.getBoard(principal, created.id);
  }

  /**
   * Copies the source board's active items into the duplicated board.
   * Columns are matched by order; comments, history, watches, and
   * external-manager flags are intentionally not copied.
   */
  private async copyItemsInto(
    principal: BoardsPrincipal,
    sourceBoardId: string,
    targetBoardId: string,
    sourceColumns: ColumnRow[],
    targetColumns: ColumnRow[],
  ): Promise<void> {
    const actor = actorRef(principal);
    const timestamp = now();
    const items = await this.knex<ItemRow>('items')
      .where('board_id', sourceBoardId)
      .whereNull('archived_at');
    const itemIds = items.map(item => item.id);
    const [assignees, labels, tags] = await Promise.all([
      this.knex('item_assignees').whereIn('item_id', itemIds),
      this.knex('item_labels').whereIn('item_id', itemIds),
      this.knex('item_tags').whereIn('item_id', itemIds),
    ]);
    const columnIdMap = new Map<string, string>();
    sourceColumns.forEach((column, index) => {
      const target = targetColumns[index];
      if (target) {
        columnIdMap.set(column.id, target.id);
      }
    });
    await this.knex.transaction(async trx => {
      for (const item of items) {
        const targetColumnId = columnIdMap.get(item.column_id);
        if (!targetColumnId) {
          continue;
        }
        const newId = uuid();
        await trx<ItemRow>('items').insert({
          id: newId,
          board_id: targetBoardId,
          column_id: targetColumnId,
          position: item.position,
          title: item.title,
          created_by: actor,
          created_at: timestamp,
          updated_by: actor,
          updated_at: timestamp,
          creator_ref: item.creator_ref,
          external_manager: null,
          description: item.description,
          archived_at: null,
          archived_by: null,
          due_date: item.due_date,
        });
        const links = (rows: Array<Record<string, unknown>>) =>
          rows
            .filter(row => row.item_id === item.id)
            .map(row => ({ ...row, item_id: newId }));
        const newAssignees = links(assignees);
        if (newAssignees.length > 0) {
          await trx('item_assignees').insert(newAssignees);
        }
        const newLabels = links(labels);
        if (newLabels.length > 0) {
          await trx('item_labels').insert(newLabels);
        }
        const newTags = links(tags);
        if (newTags.length > 0) {
          await trx('item_tags').insert(newTags);
        }
        await this.recordChange(trx, {
          itemId: newId,
          boardId: targetBoardId,
          actor,
          type: 'created',
          newValue: item.title,
        });
      }
    });
  }

  // ----------------------------------------------------------- permissions

  async listPermissions(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<BoardPermissionEntry[]> {
    await this.requireBoard(principal, boardId, 'admin');
    return (await this.permissionRows(boardId)).map(toPermission);
  }

  async addPermission(
    principal: BoardsPrincipal,
    boardId: string,
    entry: { principalRef: string; level: BoardPermissionLevel },
  ): Promise<BoardPermissionEntry> {
    await this.requireBoard(principal, boardId, 'admin');
    if (!isValidPrincipalRef(entry.principalRef)) {
      throw new InputError(
        `Invalid principal '${entry.principalRef}', expected a user or group entity ref`,
      );
    }
    this.assertLevel(entry.level);
    const existing = await this.knex<PermissionRow>('board_permissions')
      .where({ board_id: boardId, principal_ref: entry.principalRef })
      .first();
    if (existing) {
      throw new ConflictError(
        `'${entry.principalRef}' already has access to this board`,
      );
    }
    const row: PermissionRow = {
      id: uuid(),
      board_id: boardId,
      principal_ref: entry.principalRef,
      level: entry.level,
    };
    await this.knex('board_permissions').insert(row);
    return toPermission(row);
  }

  async updatePermission(
    principal: BoardsPrincipal,
    boardId: string,
    permissionId: string,
    level: BoardPermissionLevel,
  ): Promise<BoardPermissionEntry> {
    await this.requireBoard(principal, boardId, 'admin');
    this.assertLevel(level);
    const row = await this.knex<PermissionRow>('board_permissions')
      .where({ id: permissionId, board_id: boardId })
      .first();
    if (!row) {
      throw new NotFoundError(`Permission entry not found`);
    }
    if (row.level === 'admin' && level !== 'admin') {
      await this.assertNotLastAdmin(boardId);
    }
    await this.knex('board_permissions')
      .where('id', permissionId)
      .update({ level });
    return { ...toPermission(row), level };
  }

  async removePermission(
    principal: BoardsPrincipal,
    boardId: string,
    permissionId: string,
  ): Promise<void> {
    await this.requireBoard(principal, boardId, 'admin');
    const row = await this.knex<PermissionRow>('board_permissions')
      .where({ id: permissionId, board_id: boardId })
      .first();
    if (!row) {
      throw new NotFoundError(`Permission entry not found`);
    }
    if (row.level === 'admin') {
      await this.assertNotLastAdmin(boardId);
    }
    await this.knex('board_permissions').where('id', permissionId).delete();
  }

  private assertLevel(level: string): void {
    if (!['read', 'write', 'admin'].includes(level)) {
      throw new InputError(`Invalid permission level '${level}'`);
    }
  }

  private async assertNotLastAdmin(boardId: string): Promise<void> {
    const admins = await this.knex('board_permissions')
      .where({ board_id: boardId, level: 'admin' })
      .count({ count: '*' })
      .first();
    if (Number(admins?.count ?? 0) <= 1) {
      throw new ConflictError(
        'A board must keep at least one admin; add another admin first',
      );
    }
  }

  // --------------------------------------------------------------- columns

  async addColumn(
    principal: BoardsPrincipal,
    boardId: string,
    options: { title: string; position?: number; color?: string },
  ): Promise<BoardColumn> {
    await this.requireBoard(principal, boardId, 'write');
    const title = options.title?.trim();
    if (!title) {
      throw new InputError('Column title must not be empty');
    }
    if (options.color) {
      assertColumnColor(options.color);
    }
    let position = options.position;
    if (position === undefined) {
      const max = await this.knex('board_columns')
        .where('board_id', boardId)
        .max({ max: 'position' })
        .first();
      position = Number(max?.max ?? 0) + POSITION_STEP;
    }
    const row: ColumnRow = {
      id: uuid(),
      board_id: boardId,
      title,
      position,
      color: options.color ?? null,
    };
    await this.knex('board_columns').insert(row);
    await this.emitBoardSignal(boardId);
    return toColumn(row);
  }

  async updateColumn(
    principal: BoardsPrincipal,
    boardId: string,
    columnId: string,
    update: { title?: string; position?: number; color?: string | null },
  ): Promise<BoardColumn> {
    await this.requireBoard(principal, boardId, 'write');
    const row = await this.knex<ColumnRow>('board_columns')
      .where({ id: columnId, board_id: boardId })
      .first();
    if (!row) {
      throw new NotFoundError(`Column ${columnId} not found`);
    }
    const patch: Partial<ColumnRow> = {};
    if (update.title !== undefined) {
      const title = update.title.trim();
      if (!title) {
        throw new InputError('Column title must not be empty');
      }
      patch.title = title;
    }
    if (update.position !== undefined) {
      patch.position = update.position;
    }
    if (update.color !== undefined) {
      if (update.color) {
        assertColumnColor(update.color);
      }
      patch.color = update.color;
    }
    if (Object.keys(patch).length > 0) {
      await this.knex('board_columns').where('id', columnId).update(patch);
      await this.emitBoardSignal(boardId);
    }
    return toColumn({ ...row, ...patch });
  }

  async deleteColumn(
    principal: BoardsPrincipal,
    boardId: string,
    columnId: string,
    options?: { moveItemsTo?: string },
  ): Promise<void> {
    await this.requireBoard(principal, boardId, 'write');
    const row = await this.knex<ColumnRow>('board_columns')
      .where({ id: columnId, board_id: boardId })
      .first();
    if (!row) {
      throw new NotFoundError(`Column ${columnId} not found`);
    }
    const itemCount = Number(
      (
        await this.knex('items')
          .where('column_id', columnId)
          .count({ count: '*' })
          .first()
      )?.count ?? 0,
    );
    if (itemCount > 0) {
      const target = options?.moveItemsTo;
      if (!target) {
        throw new ConflictError(
          'Column still contains items; choose a column to move them to',
        );
      }
      if (target === columnId) {
        throw new InputError('Target column must differ from the deleted one');
      }
      const targetRow = await this.knex<ColumnRow>('board_columns')
        .where({ id: target, board_id: boardId })
        .first();
      if (!targetRow) {
        throw new NotFoundError(`Target column ${target} not found`);
      }
      await this.knex.transaction(async trx => {
        await trx('items')
          .where('column_id', columnId)
          .update({ column_id: target });
        await trx('board_columns').where('id', columnId).delete();
      });
      await this.emitBoardSignal(boardId);
      return;
    }
    await this.knex('board_columns').where('id', columnId).delete();
    await this.emitBoardSignal(boardId);
  }

  // ----------------------------------------------------------------- items

  private async hydrateItems(
    rows: ItemRow[],
    userRef?: string,
  ): Promise<BoardItem[]> {
    const ids = rows.map(row => row.id);
    if (ids.length === 0) {
      return [];
    }
    const assignees = await this.knex('item_assignees')
      .whereIn('item_id', ids)
      .select('item_id', 'assignee_ref');
    const labels = await this.knex('item_labels')
      .whereIn('item_id', ids)
      .select('item_id', 'key', 'value');
    const tags = await this.knex('item_tags')
      .whereIn('item_id', ids)
      .select('item_id', 'tag');
    const watches = userRef
      ? await this.knex('watches')
          .where({ user_ref: userRef, target_type: 'item' })
          .whereIn('target_id', ids)
          .select('target_id')
      : [];
    const watchedIds = new Set(watches.map(row => row.target_id));
    const versionCounts: Array<{ item_id: string; count: number | string }> =
      await this.knex('item_description_versions')
        .whereIn('item_id', ids)
        .groupBy('item_id')
        .select('item_id')
        .count({ count: '*' });
    const versionCountById = new Map(
      versionCounts.map(row => [row.item_id, Number(row.count)]),
    );

    return rows.map(row => ({
      id: row.id,
      boardId: row.board_id,
      columnId: row.column_id,
      position: row.position,
      title: row.title,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
      creatorRef: row.creator_ref ?? undefined,
      externalManager: row.external_manager ?? undefined,
      description: row.description ?? undefined,
      descriptionVersionCount: versionCountById.get(row.id) ?? 0,
      archivedAt: row.archived_at ?? undefined,
      archivedBy: row.archived_by ?? undefined,
      dueDate: row.due_date ?? undefined,
      assignees: assignees
        .filter(a => a.item_id === row.id)
        .map(a => a.assignee_ref),
      labels: Object.fromEntries(
        labels.filter(l => l.item_id === row.id).map(l => [l.key, l.value]),
      ),
      tags: tags.filter(t => t.item_id === row.id).map(t => t.tag),
      watching: watchedIds.has(row.id),
    }));
  }

  async listItems(
    principal: BoardsPrincipal,
    boardId: string,
    filter?: ItemFilter,
  ): Promise<BoardItem[]> {
    await this.requireBoard(principal, boardId, 'read');
    const query = this.knex<ItemRow>('items')
      .where('items.board_id', boardId)
      .whereNull('items.archived_at')
      .orderBy('position');
    const text = filter?.text?.trim().toLocaleLowerCase('en-US');
    if (text) {
      const pattern = `%${text}%`;
      query.where(builder =>
        builder
          .whereRaw('lower(items.title) like ?', [pattern])
          .orWhereRaw("lower(coalesce(items.description, '')) like ?", [
            pattern,
          ]),
      );
    }
    for (const tag of filter?.tags ?? []) {
      query.whereExists(builder =>
        builder
          .select('*')
          .from('item_tags')
          .whereRaw('item_tags.item_id = items.id')
          .where('item_tags.tag', tag),
      );
    }
    for (const [key, value] of Object.entries(filter?.labels ?? {})) {
      query.whereExists(builder =>
        builder
          .select('*')
          .from('item_labels')
          .whereRaw('item_labels.item_id = items.id')
          .where('item_labels.key', key)
          .where('item_labels.value', value),
      );
    }
    const rows = await query;
    return this.hydrateItems(
      rows,
      principal.type === 'user' ? principal.userRef : undefined,
    );
  }

  /**
   * All items assigned to the user (directly or via an ownership group)
   * across readable, non-archived boards.
   */
  async listMyItems(principal: BoardsPrincipal): Promise<MyBoardItem[]> {
    if (principal.type !== 'user') {
      throw new NotAllowedError(
        'Listing your items requires a logged-in user',
      );
    }
    const refs = [
      ...new Set([principal.userRef, ...principal.ownershipRefs]),
    ];
    const itemIds = (
      await this.knex('item_assignees')
        .whereIn('assignee_ref', refs)
        .select('item_id')
    ).map(row => row.item_id as string);
    if (itemIds.length === 0) {
      return [];
    }
    const rows = await this.knex<ItemRow>('items')
      .whereIn('id', itemIds)
      .whereNull('archived_at');
    const boardIds = [...new Set(rows.map(row => row.board_id))];
    const boards = await this.knex<BoardRow>('boards')
      .whereIn('id', boardIds)
      .whereNull('archived_at');
    const readable = new Map<string, BoardRow>();
    for (const board of boards) {
      if (await this.effectiveLevel(principal, board)) {
        readable.set(board.id, board);
      }
    }
    const visible = rows.filter(row => readable.has(row.board_id));
    if (visible.length === 0) {
      return [];
    }
    const columns = await this.knex<ColumnRow>('board_columns').whereIn('id', [
      ...new Set(visible.map(row => row.column_id)),
    ]);
    const columnTitles = new Map(columns.map(col => [col.id, col.title]));
    const items = await this.hydrateItems(visible, principal.userRef);
    const itemsById = new Map(items.map(item => [item.id, item]));
    return visible
      .flatMap(row => {
        const item = itemsById.get(row.id);
        const board = readable.get(row.board_id);
        if (!item || !board) {
          return [];
        }
        return [
          {
            item,
            boardId: board.id,
            boardName: board.name,
            columnTitle: columnTitles.get(row.column_id) ?? '',
          },
        ];
      })
      .sort(
        (a, b) =>
          a.boardName.localeCompare(b.boardName) ||
          a.item.position - b.item.position,
      );
  }

  async getItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<BoardItem> {
    await this.requireBoard(principal, boardId, 'read');
    const row = await this.knex<ItemRow>('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!row) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const [item] = await this.hydrateItems(
      [row],
      principal.type === 'user' ? principal.userRef : undefined,
    );
    return item;
  }

  private validateActorRefs(refs: string[]): void {
    for (const ref of refs) {
      if (!isValidActorRef(ref)) {
        throw new InputError(
          `Invalid reference '${ref}': must be a catalog entity ref or start with 'text:'`,
        );
      }
    }
  }

  async createItem(
    principal: BoardsPrincipal,
    boardId: string,
    item: NewItem,
  ): Promise<BoardItem> {
    await this.requireBoard(principal, boardId, 'write');
    const title = item.title?.trim();
    if (!title) {
      throw new InputError('Item title must not be empty');
    }
    if (item.externalManager && principal.type !== 'service') {
      throw new NotAllowedError(
        'Only service callers may create externally managed items',
      );
    }
    const column = await this.knex<ColumnRow>('board_columns')
      .where({ id: item.columnId, board_id: boardId })
      .first();
    if (!column) {
      throw new NotFoundError(`Column ${item.columnId} not found`);
    }
    this.validateActorRefs([
      ...(item.creatorRef ? [item.creatorRef] : []),
      ...(item.assignees ?? []),
    ]);

    let position = item.position;
    if (position === undefined) {
      const max = await this.knex('items')
        .where('column_id', item.columnId)
        .max({ max: 'position' })
        .first();
      position = Number(max?.max ?? 0) + POSITION_STEP;
    }

    const timestamp = now();
    const actor = actorRef(principal);
    const itemId = uuid();
    await this.knex.transaction(async trx => {
      await trx<ItemRow>('items').insert({
        id: itemId,
        board_id: boardId,
        column_id: item.columnId,
        position: position!,
        title,
        created_by: actor,
        created_at: timestamp,
        updated_by: actor,
        updated_at: timestamp,
        creator_ref: item.creatorRef ?? null,
        external_manager: item.externalManager ?? null,
      });
      await this.writeAssociations(trx, itemId, item);
      await this.recordChange(trx, {
        itemId,
        boardId,
        actor,
        type: 'created',
        newValue: title,
      });
    });

    await this.notifyWatchers({
      boardId,
      itemId,
      actor,
      title: `New item on board`,
      description: `"${title}" was added`,
    });
    await this.emitBoardSignal(boardId, itemId);

    return this.getItem(principal, boardId, itemId);
  }

  private async writeAssociations(
    trx: Knex.Transaction,
    itemId: string,
    item: { assignees?: string[]; labels?: Record<string, string>; tags?: string[] },
  ): Promise<void> {
    if (item.assignees !== undefined) {
      await trx('item_assignees').where('item_id', itemId).delete();
      if (item.assignees.length > 0) {
        await trx('item_assignees').insert(
          [...new Set(item.assignees)].map(assignee => ({
            item_id: itemId,
            assignee_ref: assignee,
          })),
        );
      }
    }
    if (item.labels !== undefined) {
      await trx('item_labels').where('item_id', itemId).delete();
      const entries = Object.entries(item.labels);
      if (entries.length > 0) {
        await trx('item_labels').insert(
          entries.map(([key, value]) => ({ item_id: itemId, key, value })),
        );
      }
    }
    if (item.tags !== undefined) {
      await trx('item_tags').where('item_id', itemId).delete();
      const tags = normalizeTags(item.tags);
      if (tags.length > 0) {
        await trx('item_tags').insert(
          tags.map(tag => ({ item_id: itemId, tag })),
        );
      }
    }
  }

  private async requireMutableItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    options?: { allowArchived?: boolean },
  ): Promise<ItemRow> {
    await this.requireBoard(principal, boardId, 'write');
    const row = await this.knex<ItemRow>('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!row) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    if (row.external_manager && principal.type !== 'service') {
      throw new NotAllowedError(
        `This item is managed by '${row.external_manager}' and read-only`,
      );
    }
    if (row.archived_at && !options?.allowArchived) {
      throw new ConflictError('Item is archived; restore it first');
    }
    return row;
  }

  async updateItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    update: ItemUpdate,
  ): Promise<BoardItem> {
    const row = await this.requireMutableItem(principal, boardId, itemId);
    const [before] = await this.hydrateItems([row]);
    const actor = actorRef(principal);
    const timestamp = now();
    const changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    const patch: Partial<ItemRow> = {
      updated_by: actor,
      updated_at: timestamp,
    };
    if (update.title !== undefined && update.title !== row.title) {
      const title = update.title.trim();
      if (!title) {
        throw new InputError('Item title must not be empty');
      }
      patch.title = title;
      changes.push({ field: 'title', oldValue: row.title, newValue: title });
    }
    if (update.creatorRef !== undefined) {
      const creator = update.creatorRef;
      if (creator) {
        this.validateActorRefs([creator]);
      }
      if ((creator ?? null) !== row.creator_ref) {
        patch.creator_ref = creator ?? null;
        changes.push({
          field: 'creator',
          oldValue: row.creator_ref ?? undefined,
          newValue: creator ?? undefined,
        });
      }
    }
    let descriptionChanged = false;
    if (update.description !== undefined) {
      const next = update.description;
      const prev = row.description ?? '';
      if (next !== prev) {
        descriptionChanged = true;
        patch.description = next === '' ? null : next;
        changes.push({ field: 'description', oldValue: undefined, newValue: undefined });
      }
    }
    if (update.assignees !== undefined) {
      this.validateActorRefs(update.assignees);
      const next = [...new Set(update.assignees)].sort();
      const prev = [...before.assignees].sort();
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        changes.push({ field: 'assignees', oldValue: prev, newValue: next });
      }
    }
    if (update.labels !== undefined) {
      if (JSON.stringify(update.labels) !== JSON.stringify(before.labels)) {
        changes.push({
          field: 'labels',
          oldValue: before.labels,
          newValue: update.labels,
        });
      }
    }
    if (update.tags !== undefined) {
      const next = [...normalizeTags(update.tags)].sort();
      const prev = [...before.tags].sort();
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        changes.push({ field: 'tags', oldValue: prev, newValue: next });
      }
    }
    if (update.dueDate !== undefined) {
      const next = update.dueDate;
      if (next !== null && !isValidDueDate(next)) {
        throw new InputError(
          `Invalid due date '${next}', expected YYYY-MM-DD`,
        );
      }
      if ((next ?? null) !== row.due_date) {
        patch.due_date = next ?? null;
        changes.push({
          field: 'dueDate',
          oldValue: row.due_date ?? undefined,
          newValue: next ?? undefined,
        });
      }
    }

    if (changes.length > 0) {
      await this.knex.transaction(async trx => {
        await trx('items').where('id', itemId).update(patch);
        if (descriptionChanged) {
          await trx('item_description_versions').insert({
            id: uuid(),
            item_id: itemId,
            text: update.description ?? '',
            edited_by: actor,
            edited_at: timestamp,
          });
        }
        await this.writeAssociations(trx, itemId, update as NewItem);
        for (const change of changes) {
          await this.recordChange(trx, {
            itemId,
            boardId,
            actor,
            type: 'updated',
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
          });
        }
      });
      await this.emitBoardSignal(boardId, itemId);
      const mentioned = descriptionChanged
        ? await this.notifyMentions({
            boardId,
            itemId,
            actor,
            text: update.description ?? '',
            context: `You were mentioned in the description of "${patch.title ?? row.title}"`,
          })
        : [];
      await this.notifyWatchers({
        boardId,
        itemId,
        actor,
        title: 'Item updated',
        exclude: mentioned,
        description: `"${patch.title ?? row.title}": ${changes
          .map(change => change.field)
          .join(', ')} changed`,
      });
    }

    return this.getItem(principal, boardId, itemId);
  }

  async moveItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    target: { columnId: string; position?: number },
  ): Promise<BoardItem> {
    const row = await this.requireMutableItem(principal, boardId, itemId);
    const targetColumn = await this.knex<ColumnRow>('board_columns')
      .where({ id: target.columnId, board_id: boardId })
      .first();
    if (!targetColumn) {
      throw new NotFoundError(`Column ${target.columnId} not found`);
    }
    let position = target.position;
    if (position === undefined) {
      const max = await this.knex('items')
        .where('column_id', target.columnId)
        .max({ max: 'position' })
        .first();
      position = Number(max?.max ?? 0) + POSITION_STEP;
    }
    const actor = actorRef(principal);
    const movedColumns = row.column_id !== target.columnId;
    await this.knex.transaction(async trx => {
      await trx('items').where('id', itemId).update({
        column_id: target.columnId,
        position,
        updated_by: actor,
        updated_at: now(),
      });
      if (movedColumns) {
        const oldColumn = await trx<ColumnRow>('board_columns')
          .where('id', row.column_id)
          .first();
        await this.recordChange(trx, {
          itemId,
          boardId,
          actor,
          type: 'moved',
          field: 'status',
          oldValue: oldColumn?.title ?? row.column_id,
          newValue: targetColumn.title,
        });
      }
    });
    await this.emitBoardSignal(boardId, itemId);
    if (movedColumns) {
      await this.notifyWatchers({
        boardId,
        itemId,
        actor,
        title: 'Item moved',
        description: `"${row.title}" moved to "${targetColumn.title}"`,
      });
    }
    return this.getItem(principal, boardId, itemId);
  }

  /** Archives (soft-deletes) an item; it stays restorable until purged. */
  async deleteItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<void> {
    const row = await this.requireMutableItem(principal, boardId, itemId);
    const actor = actorRef(principal);
    const timestamp = now();
    await this.knex.transaction(async trx => {
      await trx('items').where('id', itemId).update({
        archived_at: timestamp,
        archived_by: actor,
        updated_by: actor,
        updated_at: timestamp,
      });
      await this.recordChange(trx, {
        itemId,
        boardId,
        actor,
        type: 'archived',
      });
    });
    await this.emitBoardSignal(boardId, itemId);
    await this.notifyWatchers({
      boardId,
      itemId,
      actor,
      title: 'Item archived',
      description: `"${row.title}" was archived`,
    });
  }

  async listArchivedItems(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<BoardItem[]> {
    await this.requireBoard(principal, boardId, 'write');
    const rows = await this.knex<ItemRow>('items')
      .where('board_id', boardId)
      .whereNotNull('archived_at')
      .orderBy('archived_at', 'desc');
    return this.hydrateItems(
      rows,
      principal.type === 'user' ? principal.userRef : undefined,
    );
  }

  async restoreItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<BoardItem> {
    const row = await this.requireMutableItem(principal, boardId, itemId, {
      allowArchived: true,
    });
    if (!row.archived_at) {
      throw new ConflictError('Item is not archived');
    }
    const actor = actorRef(principal);
    const timestamp = now();
    await this.knex.transaction(async trx => {
      await trx('items').where('id', itemId).update({
        archived_at: null,
        archived_by: null,
        updated_by: actor,
        updated_at: timestamp,
      });
      await this.recordChange(trx, {
        itemId,
        boardId,
        actor,
        type: 'restored',
      });
    });
    await this.emitBoardSignal(boardId, itemId);
    await this.notifyWatchers({
      boardId,
      itemId,
      actor,
      title: 'Item restored',
      description: `"${row.title}" was restored`,
    });
    return this.getItem(principal, boardId, itemId);
  }

  /** Permanently removes items archived before `olderThan`. */
  async purgeArchivedItems(olderThan: Date): Promise<number> {
    const cutoff = olderThan.toISOString();
    const rows = await this.knex('items')
      .whereNotNull('archived_at')
      .where('archived_at', '<', cutoff)
      .select('id');
    const ids = rows.map(row => row.id as string);
    if (ids.length === 0) {
      return 0;
    }
    await this.knex.transaction(async trx => {
      await trx('watches')
        .where('target_type', 'item')
        .whereIn('target_id', ids)
        .delete();
      await trx('items').whereIn('id', ids).delete();
    });
    this.logger.info(`Purged ${ids.length} archived board items`);
    return ids.length;
  }

  // -------------------------------------------------------------- comments

  async addComment(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    text: string,
  ): Promise<ItemComment> {
    await this.requireBoard(principal, boardId, 'write');
    const item = await this.knex<ItemRow>('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    if (item.archived_at) {
      throw new ConflictError('Item is archived; restore it first');
    }
    if (!text?.trim()) {
      throw new InputError('Comment text must not be empty');
    }
    const actor = actorRef(principal);
    const timestamp = now();
    const commentId = uuid();
    await this.knex.transaction(async trx => {
      await trx('comments').insert({
        id: commentId,
        item_id: itemId,
        author_ref: actor,
        created_at: timestamp,
      });
      await trx('comment_versions').insert({
        id: uuid(),
        comment_id: commentId,
        text,
        edited_by: actor,
        edited_at: timestamp,
      });
    });
    await this.emitBoardSignal(boardId, itemId);
    const mentioned = await this.notifyMentions({
      boardId,
      itemId,
      actor,
      text,
      context: `You were mentioned in a comment on "${item.title}"`,
    });
    await this.notifyWatchers({
      boardId,
      itemId,
      actor,
      title: 'New comment',
      description: `New comment on "${item.title}"`,
      exclude: mentioned,
    });
    const [comment] = await this.hydrateComments([commentId]);
    return comment;
  }

  private async hydrateComments(commentIds: string[]): Promise<ItemComment[]> {
    if (commentIds.length === 0) {
      return [];
    }
    const comments = await this.knex('comments').whereIn('id', commentIds);
    const versions = await this.knex('comment_versions')
      .whereIn('comment_id', commentIds)
      .orderBy('edited_at');
    return comments.map(comment => {
      const own = versions.filter(v => v.comment_id === comment.id);
      const latest = own[own.length - 1];
      return {
        id: comment.id,
        itemId: comment.item_id,
        authorRef: comment.author_ref,
        createdAt: comment.created_at,
        text: latest?.text ?? '',
        editedBy: own.length > 1 ? latest.edited_by : undefined,
        editedAt: own.length > 1 ? latest.edited_at : undefined,
        versionCount: own.length,
      };
    });
  }

  private async requireCommentAccess(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<{ comment: any; itemTitle: string }> {
    const { board, level } = await this.requireBoard(
      principal,
      boardId,
      'write',
    );
    const item = await this.knex<ItemRow>('items')
      .where({ id: itemId, board_id: board.id })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const comment = await this.knex('comments')
      .where({ id: commentId, item_id: itemId })
      .first();
    if (!comment) {
      throw new NotFoundError(`Comment not found`);
    }
    const isAuthor = comment.author_ref === actorRef(principal);
    const isAdmin = levelIncludes(level, 'admin');
    if (!isAuthor && !isAdmin) {
      throw new NotAllowedError(
        'Only the comment author or a board admin may modify a comment',
      );
    }
    return { comment, itemTitle: item.title };
  }

  async updateComment(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    commentId: string,
    text: string,
  ): Promise<ItemComment> {
    const { itemTitle } = await this.requireCommentAccess(
      principal,
      boardId,
      itemId,
      commentId,
    );
    if (!text?.trim()) {
      throw new InputError('Comment text must not be empty');
    }
    const actor = actorRef(principal);
    await this.knex('comment_versions').insert({
      id: uuid(),
      comment_id: commentId,
      text,
      edited_by: actor,
      edited_at: now(),
    });
    await this.emitBoardSignal(boardId, itemId);
    const mentioned = await this.notifyMentions({
      boardId,
      itemId,
      actor,
      text,
      context: `You were mentioned in a comment on "${itemTitle}"`,
    });
    await this.notifyWatchers({
      boardId,
      itemId,
      actor,
      title: 'Comment edited',
      description: `A comment on "${itemTitle}" was edited`,
      exclude: mentioned,
    });
    const [comment] = await this.hydrateComments([commentId]);
    return comment;
  }

  async deleteComment(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<void> {
    await this.requireCommentAccess(principal, boardId, itemId, commentId);
    await this.knex('comments').where('id', commentId).delete();
    await this.emitBoardSignal(boardId, itemId);
  }

  async listCommentVersions(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    commentId: string,
  ): Promise<CommentVersion[]> {
    await this.requireBoard(principal, boardId, 'read');
    const comment = await this.knex('comments')
      .where({ id: commentId, item_id: itemId })
      .first();
    if (!comment) {
      throw new NotFoundError(`Comment not found`);
    }
    const versions = await this.knex('comment_versions')
      .where('comment_id', commentId)
      .orderBy('edited_at');
    return versions.map(version => ({
      id: version.id,
      commentId: version.comment_id,
      text: version.text,
      editedBy: version.edited_by,
      editedAt: version.edited_at,
    }));
  }

  async listDescriptionVersions(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<CommentVersion[]> {
    await this.requireBoard(principal, boardId, 'read');
    const item = await this.knex('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const versions = await this.knex('item_description_versions')
      .where('item_id', itemId)
      .orderBy('edited_at');
    return versions.map(version => ({
      id: version.id,
      commentId: itemId,
      text: version.text,
      editedBy: version.edited_by,
      editedAt: version.edited_at,
    }));
  }

  // -------------------------------------------------------------- timeline

  async getTimeline(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<TimelineEntry[]> {
    await this.requireBoard(principal, boardId, 'read');
    const item = await this.knex<ItemRow>('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const commentRows = await this.knex('comments').where('item_id', itemId);
    const comments = await this.hydrateComments(
      commentRows.map(row => row.id),
    );
    const changeRows = await this.knex<ChangeRow>('changes').where(
      'item_id',
      itemId,
    );
    const entries: TimelineEntry[] = [
      ...comments.map(comment => ({
        kind: 'comment' as const,
        at: comment.createdAt,
        comment,
      })),
      ...changeRows.map(row => {
        const change = toChange(row);
        return { kind: 'change' as const, at: change.at, change };
      }),
    ];
    return entries.sort((a, b) => a.at.localeCompare(b.at));
  }

  async getBoardChanges(
    principal: BoardsPrincipal,
    boardId: string,
    options?: { limit?: number },
  ): Promise<BoardChangeEntry[]> {
    await this.requireBoard(principal, boardId, 'read');
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const rows: Array<ChangeRow & { item_title: string }> = await this.knex(
      'changes',
    )
      .join('items', 'items.id', 'changes.item_id')
      .where('changes.board_id', boardId)
      .orderBy('changes.at', 'desc')
      .limit(limit)
      .select('changes.*', 'items.title as item_title');
    return rows.map(row => ({
      change: toChange(row),
      itemTitle: row.item_title,
    }));
  }

  // --------------------------------------------------------------- watches

  async setWatchBoard(
    principal: BoardsPrincipal,
    boardId: string,
    watching: boolean,
  ): Promise<void> {
    const userRef = this.requireUserRef(principal);
    await this.requireBoard(principal, boardId, 'read');
    await this.setWatch(userRef, 'board', boardId, watching);
  }

  async setWatchItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    watching: boolean,
  ): Promise<void> {
    const userRef = this.requireUserRef(principal);
    await this.requireBoard(principal, boardId, 'read');
    const item = await this.knex('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    await this.setWatch(userRef, 'item', itemId, watching);
  }

  private async setWatch(
    userRef: string,
    targetType: 'board' | 'item',
    targetId: string,
    watching: boolean,
  ): Promise<void> {
    await this.knex('watches')
      .where({ user_ref: userRef, target_type: targetType, target_id: targetId })
      .delete();
    if (watching) {
      await this.knex('watches').insert({
        user_ref: userRef,
        target_type: targetType,
        target_id: targetId,
      });
    }
  }

  async listBoardWatchers(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<string[]> {
    await this.requireBoard(principal, boardId, 'read');
    const rows = await this.knex('watches')
      .where({ target_type: 'board', target_id: boardId })
      .orderBy('user_ref')
      .select('user_ref');
    return rows.map(row => row.user_ref as string);
  }

  async listItemWatchers(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<string[]> {
    await this.requireBoard(principal, boardId, 'read');
    const item = await this.knex('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const rows = await this.knex('watches')
      .where({ target_type: 'item', target_id: itemId })
      .orderBy('user_ref')
      .select('user_ref');
    return rows.map(row => row.user_ref as string);
  }

  /** Watchers of the item or its board, excluding the actor. */
  private async watcherRefs(
    boardId: string,
    itemId: string,
    actor: string,
  ): Promise<string[]> {
    const rows = await this.knex('watches')
      .where(builder =>
        builder
          .where({ target_type: 'item', target_id: itemId })
          .orWhere({ target_type: 'board', target_id: boardId }),
      )
      .select('user_ref');
    return [
      ...new Set(rows.map(row => row.user_ref as string)),
    ].filter(ref => ref !== actor && !isTextRef(ref));
  }

  private async notifyWatchers(options: {
    boardId: string;
    itemId: string;
    actor: string;
    title: string;
    description: string;
    /** Principals already notified for this event (e.g. mentions). */
    exclude?: string[];
  }): Promise<void> {
    const excluded = new Set(options.exclude ?? []);
    const recipients = (
      await this.watcherRefs(options.boardId, options.itemId, options.actor)
    ).filter(ref => !excluded.has(ref));
    await this.sendNotification(recipients, {
      title: options.title,
      description: options.description,
      boardId: options.boardId,
      itemId: options.itemId,
    });
  }

  /**
   * Notifies @-mentioned principals directly, regardless of watch state.
   * Returns the notified refs so the caller can exclude them from the
   * watcher notification of the same event.
   */
  private async notifyMentions(options: {
    boardId: string;
    itemId: string;
    actor: string;
    text: string;
    context: string;
  }): Promise<string[]> {
    const mentioned = extractMentions(options.text).filter(
      ref => ref !== options.actor,
    );
    if (mentioned.length > 0) {
      await this.sendNotification(mentioned, {
        title: 'You were mentioned',
        description: options.context,
        boardId: options.boardId,
        itemId: options.itemId,
      });
    }
    return mentioned;
  }

  private async sendNotification(
    recipients: string[],
    payload: {
      title: string;
      description: string;
      boardId: string;
      itemId?: string;
    },
  ): Promise<void> {
    if (!this.notifications || recipients.length === 0) {
      return;
    }
    const link = payload.itemId
      ? `${this.appLinkBase}/${payload.boardId}?item=${payload.itemId}`
      : `${this.appLinkBase}/${payload.boardId}`;
    try {
      await this.notifications.send({
        recipients: { type: 'entity', entityRef: recipients },
        payload: {
          title: payload.title,
          description: payload.description,
          link,
          topic: `boards:${payload.boardId}`,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to send board notification: ${error}`);
    }
  }

  // --------------------------------------------------------------- changes

  private async recordChange(
    trx: Knex.Transaction,
    change: {
      itemId: string;
      boardId: string;
      actor: string;
      type: string;
      field?: string;
      oldValue?: unknown;
      newValue?: unknown;
    },
  ): Promise<void> {
    await trx('changes').insert({
      id: uuid(),
      item_id: change.itemId,
      board_id: change.boardId,
      actor_ref: change.actor,
      at: now(),
      type: change.type,
      field: change.field ?? null,
      old_value:
        change.oldValue === undefined ? null : JSON.stringify(change.oldValue),
      new_value:
        change.newValue === undefined ? null : JSON.stringify(change.newValue),
    });
  }
}

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
  BoardInsights,
  BoardPriority,
  COLUMN_COLORS,
  ColumnColor,
  MAX_PRIORITIES,
  BoardItem,
  BoardFilterOptions,
  BoardListEntry,
  BoardListFilter,
  BoardListResult,
  BoardStatusCount,
  BoardPermissionEntry,
  BoardPermissionLevel,
  BoardUpdate,
  BoardVisibility,
  BoardWithContext,
  ChangeRecord,
  ChangeType,
  ColumnCycleTime,
  FlowDay,
  ThroughputWeek,
  ChecklistEntry,
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
  todayISO,
  isValidPrincipalRef,
  levelIncludes,
} from '@internal/plugin-boards-common';
import { Knex } from 'knex';
import { randomUUID as uuid } from 'crypto';
import {
  BoardRow,
  ChangeRow,
  CommentRow,
  ColumnRow,
  ItemRow,
  PermissionRow,
  PriorityRow,
} from '../database/tables';
import {
  BoardsPrincipal,
  actorRef,
  computeEffectiveLevel,
  visibleVisibilities,
} from './access';

const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done'];

/** Trims entry labels, rejecting empty ones; keeps the given order. */
function normalizeChecklist(entries: ChecklistEntry[]): ChecklistEntry[] {
  if (!Array.isArray(entries)) {
    throw new InputError('checklist must be an array of entries');
  }
  return entries.map(entry => {
    const text = typeof entry?.text === 'string' ? entry.text.trim() : '';
    if (!text) {
      throw new InputError('Checklist entries must not be empty');
    }
    return { text, checked: !!entry.checked };
  });
}

/** Priorities every new board starts with, in order (1 = highest). */
const DEFAULT_PRIORITIES: Array<{ name: string; color: ColumnColor | null }> = [
  { name: 'critical', color: 'red' },
  { name: 'high', color: 'orange' },
  { name: 'medium', color: null },
  { name: 'low', color: null },
];

/** One row of the grouped item count per board column. */
type ColumnItemCount = { column_id: string; total: string | number };
/** The single row a `count(*)` yields. */
type TotalCount = { total: string | number };
const POSITION_STEP = 1000;

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

/**
 * Escapes the LIKE wildcards in a search term, so a board named "100%"
 * is found by searching for "100%" rather than by everything.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
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
    color: row.color ?? undefined,
    wipSoftLimit: row.wip_soft_limit ?? undefined,
    wipHardLimit: row.wip_hard_limit ?? undefined,
  };
}

function isColumnColor(value: string): value is ColumnColor {
  return Object.keys(COLUMN_COLORS).includes(value);
}

/** Narrows a caller-supplied colour name to the fixed palette. */
function parseWipLimit(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new InputError(`${label} must be a positive integer`);
  }
  return value;
}

function requireSoftAtMostHard(soft: number | null, hard: number | null): void {
  if (soft !== null && hard !== null && soft > hard) {
    throw new InputError('Soft WIP limit must not exceed the hard WIP limit');
  }
}

function parseColumnColor(color: string): ColumnColor {
  if (!isColumnColor(color)) {
    throw new InputError(`Invalid column color '${color}'`);
  }
  return color;
}

/** Priorities share the columns' fixed palette. */
function parsePriorityColor(color: string): ColumnColor {
  if (!isColumnColor(color)) {
    throw new InputError(`Invalid priority color '${color}'`);
  }
  return color;
}

function toPriority(row: PriorityRow): BoardPriority {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    color: row.color ?? undefined,
    order: row.ord,
  };
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
    type: row.type,
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
  /**
   * Called with the entity refs whose set of referencing boards may have
   * changed, so the catalog can re-derive the `boards` label on them. Kept
   * as a hook rather than a catalog dependency so the service stays
   * catalog-agnostic; failures are the hook's own to handle.
   */
  onEntityRefsChanged?: (entityRefs: string[]) => void;
}

export class BoardsService {
  private readonly knex: Knex;
  private readonly logger: LoggerService;
  private readonly notifications?: NotificationService;
  private readonly signals?: SignalsService;
  private readonly appLinkBase: string;
  private readonly onEntityRefsChanged?: (entityRefs: string[]) => void;

  constructor(options: BoardsServiceOptions) {
    this.knex = options.knex;
    this.logger = options.logger;
    this.notifications = options.notifications;
    this.signals = options.signals;
    this.appLinkBase = options.appLinkBase ?? '/boards';
    this.onEntityRefsChanged = options.onEntityRefsChanged;
  }

  /**
   * Reports entity refs whose board references changed. Deduped, and never
   * called with an empty list.
   */
  private notifyEntityRefsChanged(...refs: string[][]): void {
    if (!this.onEntityRefsChanged) {
      return;
    }
    const unique = [...new Set(refs.flat())];
    if (unique.length === 0) {
      return;
    }
    try {
      this.onEntityRefsChanged(unique);
    } catch (error) {
      this.logger.warn(`Failed to report changed entity refs: ${error}`);
    }
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
    return this.knex('board_permissions').where('board_id', boardId);
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
   * Every non-archived board the principal may see, as a query to build
   * on. The listing's filtering, ordering, paging, counting and filter
   * options all start from this one builder, so they cannot disagree
   * about which boards are the caller's.
   *
   * The visibility half of the predicate comes from
   * {@link visibleVisibilities}, which is derived from the same
   * `visibilityLevel` the effective level uses; the grant half mirrors
   * `computeEffectiveLevel` and is pinned to it by a test. Service
   * principals see everything, as they do there.
   */
  private visibleBoards(principal: BoardsPrincipal) {
    const query = this.knex('boards').whereNull('archived_at');
    if (principal.type === 'service') {
      return query;
    }
    const refs =
      principal.type === 'user'
        ? [principal.userRef, ...principal.ownershipRefs]
        : [];
    return query.where(builder => {
      builder.whereIn('visibility', visibleVisibilities(principal));
      if (refs.length > 0) {
        builder.orWhereExists(function grantMatch() {
          this.select('*')
            .from('board_permissions')
            .whereRaw('board_permissions.board_id = boards.id')
            .whereIn('board_permissions.principal_ref', refs);
        });
      }
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
    const board = await this.knex('boards').where('id', boardId).first();
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
      /**
       * Priority definitions in order; undefined seeds the defaults, an
       * empty list creates a board without priorities (used when
       * duplicating a source board that has none).
       */
      priorities?: Array<{ name: string; color?: ColumnColor }>;
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
    const priorities =
      options.priorities ??
      DEFAULT_PRIORITIES.map(entry => ({
        name: entry.name,
        color: entry.color ?? undefined,
      }));
    if (priorities.length > MAX_PRIORITIES) {
      throw new InputError(
        `A board can define at most ${MAX_PRIORITIES} priorities`,
      );
    }

    await this.knex.transaction(async trx => {
      await trx('boards').insert({
        id: boardId,
        name,
        description: null,
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
      await trx('board_columns').insert(
        columnTitles.map((title, index) => ({
          id: uuid(),
          board_id: boardId,
          title,
          position: (index + 1) * POSITION_STEP,
          color: null,
        })),
      );
      if (priorities.length > 0) {
        await trx('board_priorities').insert(
          priorities.map((entry, index) => ({
            id: uuid(),
            board_id: boardId,
            name: entry.name,
            color: entry.color ?? null,
            ord: index + 1,
          })),
        );
      }
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
        await trx('board_permissions').insert(
          [...adminRefs].map(ref => ({
            id: uuid(),
            board_id: boardId,
            principal_ref: ref,
            level: 'admin' as const,
          })),
        );
      }
    });

    this.notifyEntityRefsChanged(entityRefs);

    return this.getBoard(principal, boardId);
  }

  async getBoard(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<BoardWithContext> {
    const { board, level } = await this.requireBoard(
      principal,
      boardId,
      'read',
    );
    const columns = await this.knex('board_columns')
      .where('board_id', boardId)
      .orderBy('position');
    const priorities = await this.knex('board_priorities')
      .where('board_id', boardId)
      .orderBy('ord');
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
    const entityRefs =
      (await this.entityRefsByBoard([boardId])).get(boardId) ?? [];
    const descriptionVersionCount = Number(
      (
        await this.knex('board_description_versions')
          .where('board_id', boardId)
          .count({ count: '*' })
          .first()
      )?.count ?? 0,
    );
    return {
      ...toBoard(board, entityRefs),
      description: board.description ?? undefined,
      descriptionVersionCount,
      columns: columns.map(toColumn),
      priorities: priorities.map(toPriority),
      access: level,
      favorite,
      watching,
    };
  }

  /**
   * Sets or clears the board's markdown description, retaining every
   * effective change as a version. Content editing, so write access
   * suffices (unlike the admin-gated board settings).
   */
  async updateBoardDescription(
    principal: BoardsPrincipal,
    boardId: string,
    text: string,
  ): Promise<BoardWithContext> {
    const { board } = await this.requireBoard(principal, boardId, 'write');
    const next = text.trim();
    const current = board.description ?? '';
    if (next !== current) {
      const timestamp = now();
      await this.knex.transaction(async trx => {
        await trx('boards')
          .where('id', boardId)
          .update({ description: next || null, updated_at: timestamp });
        await trx('board_description_versions').insert({
          id: uuid(),
          board_id: boardId,
          text: next,
          edited_by: actorRef(principal),
          edited_at: timestamp,
        });
      });
      await this.emitBoardSignal(boardId);
    }
    return this.getBoard(principal, boardId);
  }

  async listBoardDescriptionVersions(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<CommentVersion[]> {
    await this.requireBoard(principal, boardId, 'read');
    const versions = await this.knex('board_description_versions')
      .where('board_id', boardId)
      .orderBy('edited_at');
    return versions.map(version => ({
      id: version.id,
      commentId: boardId,
      text: version.text,
      editedBy: version.edited_by,
      editedAt: version.edited_at,
    }));
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

  /**
   * Whether any non-archived board references the given entity.
   *
   * Deliberately independent of any principal: it answers for the catalog
   * processor that labels referenced entities, and the route exposing it is
   * restricted to service-to-service callers. Matching is exact, the same as
   * the `entityRef` filter of {@link listBoards}, so the label and the tab's
   * listing always agree on what "referenced" means.
   */
  async isEntityReferenced(entityRef: string): Promise<boolean> {
    const row = await this.knex('board_entities')
      .join('boards', 'boards.id', 'board_entities.board_id')
      .whereNull('boards.archived_at')
      .where('board_entities.entity_ref', entityRef)
      .first('board_entities.board_id');
    return !!row;
  }

  /**
   * The caller's boards narrowed by a filter. Every filter is a SQL
   * predicate rather than a pass over loaded rows, so the page, the
   * total and the filter options are all computed over the same set.
   */
  private filteredBoards(principal: BoardsPrincipal, filter?: BoardListFilter) {
    const query = this.visibleBoards(principal);
    const search = filter?.search?.trim();
    if (search) {
      query.whereRaw(`lower(name) like ? escape '\\'`, [
        `%${escapeLike(search.toLocaleLowerCase('en-US'))}%`,
      ]);
    }
    if (filter?.entityRef) {
      const entityRef = filter.entityRef;
      query.whereExists(function entityMatch() {
        this.select('*')
          .from('board_entities')
          .whereRaw('board_entities.board_id = boards.id')
          .where('board_entities.entity_ref', entityRef);
      });
    }
    if (filter?.createdBy) {
      query.where('created_by', filter.createdBy);
    }
    if (filter?.favoritesOnly) {
      // favorites are per-user; nobody else has any
      const userRef = principal.type === 'user' ? principal.userRef : undefined;
      if (userRef) {
        query.whereExists(function favoriteMatch() {
          this.select('*')
            .from('favorites')
            .whereRaw('favorites.board_id = boards.id')
            .where('favorites.user_ref', userRef);
        });
      } else {
        query.whereRaw('1 = 0');
      }
    }
    return query;
  }

  async listBoards(
    principal: BoardsPrincipal,
    options?: BoardListFilter & {
      withCounts?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<BoardListResult> {
    // a second builder rather than a clone: both start from the same
    // private predicate, so they cannot describe different sets
    const countRows = (await this.filteredBoards(principal, options).count({
      total: '*',
    })) as unknown as TotalCount[];
    const total = Number(countRows[0]?.total ?? 0);

    // id breaks the tie so two boards of the same name cannot swap
    // places between two page requests
    const query = this.filteredBoards(principal, options).orderBy([
      { column: 'name' },
      { column: 'id' },
    ]);
    if (options?.limit !== undefined) {
      query.limit(options.limit).offset(options.offset ?? 0);
    }
    const rows = await query;
    const ids = rows.map(row => row.id);

    // three independent lookups over the same page of ids
    const [refsByBoard, entriesByBoard, favoriteIds] = await Promise.all([
      this.entityRefsByBoard(ids),
      this.permissionEntriesByBoard(ids),
      this.favoriteIds(principal, ids),
    ]);

    const boards: BoardListEntry[] = [];
    for (const row of rows) {
      const level = computeEffectiveLevel({
        principal,
        visibility: row.visibility,
        entries: entriesByBoard.get(row.id) ?? [],
      });
      if (!level) {
        // the query applied the same rule, so this is unreachable unless
        // the two have drifted apart — which a test asserts they have not
        continue;
      }
      boards.push({
        ...toBoard(row, refsByBoard.get(row.id) ?? []),
        access: level,
        favorite: favoriteIds.has(row.id),
      });
    }

    if (options?.withCounts) {
      // counted over the returned page alone: a board the caller cannot
      // read, or one on another page, contributes nothing
      const countsByBoard = await this.statusCountsByBoard(
        boards.map(entry => entry.id),
      );
      for (const entry of boards) {
        entry.statusCounts = countsByBoard.get(entry.id) ?? [];
      }
    }

    return {
      boards,
      total,
      ...(options?.limit === undefined
        ? {}
        : { limit: options.limit, offset: options.offset ?? 0 }),
    };
  }

  /**
   * The options the board list's filter dropdowns offer: the entities
   * referenced by the caller's boards and the users who created them,
   * and nothing else. Derived from the caller's whole readable set
   * rather than from a filtered one, so a selection can always be
   * widened again.
   */
  async listFilterOptions(
    principal: BoardsPrincipal,
  ): Promise<BoardFilterOptions> {
    const ids = (await this.visibleBoards(principal).select('id')).map(
      row => row.id,
    );
    if (ids.length === 0) {
      return { total: 0, favorites: 0, entityRefs: [], creators: [] };
    }
    const entityRows = await this.knex('board_entities')
      .whereIn('board_id', ids)
      .distinct('entity_ref')
      .orderBy('entity_ref');
    const creatorRows = await this.knex('boards')
      .whereIn('id', ids)
      .distinct('created_by')
      .orderBy('created_by');
    // favorites are per-user; nobody else has any
    const userRef = principal.type === 'user' ? principal.userRef : undefined;
    const favoriteRows = userRef
      ? await this.knex('favorites')
          .whereIn('board_id', ids)
          .where('user_ref', userRef)
          .count({ count: '*' })
      : undefined;
    return {
      total: ids.length,
      favorites: Number(favoriteRows?.[0]?.count ?? 0),
      entityRefs: entityRows.map(row => row.entity_ref),
      creators: creatorRows.map(row => row.created_by),
    };
  }

  /**
   * Batch-loads the permission entries of a set of boards, in the shape
   * {@link computeEffectiveLevel} takes. One query for a whole page,
   * where the single-board paths load one board's rows at a time.
   */
  private async permissionEntriesByBoard(
    boardIds: string[],
  ): Promise<
    Map<string, Array<{ principalRef: string; level: BoardPermissionLevel }>>
  > {
    const map = new Map<
      string,
      Array<{ principalRef: string; level: BoardPermissionLevel }>
    >();
    if (boardIds.length === 0) {
      return map;
    }
    const rows = await this.knex('board_permissions').whereIn(
      'board_id',
      boardIds,
    );
    for (const row of rows) {
      map.set(row.board_id, [
        ...(map.get(row.board_id) ?? []),
        { principalRef: row.principal_ref, level: row.level },
      ]);
    }
    return map;
  }

  /** Which of the given boards the principal has favorited. */
  private async favoriteIds(
    principal: BoardsPrincipal,
    boardIds: string[],
  ): Promise<Set<string>> {
    if (principal.type !== 'user' || boardIds.length === 0) {
      return new Set();
    }
    const rows = await this.knex('favorites')
      .where('user_ref', principal.userRef)
      .whereIn('board_id', boardIds)
      .select('board_id');
    return new Set(rows.map(row => row.board_id));
  }

  /**
   * Batch-loads per-column item counts for a set of boards. Columns
   * without items are reported with a count of 0 so a board's shape stays
   * readable; archived items are not counted.
   */
  private async statusCountsByBoard(
    boardIds: string[],
  ): Promise<Map<string, BoardStatusCount[]>> {
    const map = new Map<string, BoardStatusCount[]>();
    if (boardIds.length === 0) {
      return map;
    }
    const columns = await this.knex('board_columns')
      .whereIn('board_id', boardIds)
      .orderBy(['board_id', 'position']);
    // knex infers an aggregate query's rows as the aggregate alone, so the
    // grouped column has to be named again in the result type
    const countRows = await this.knex('items')
      .whereIn('board_id', boardIds)
      .whereNull('archived_at')
      .groupBy('column_id')
      .select('column_id')
      .count<{ total: string }, ColumnItemCount[]>({ total: '*' });
    const counts = new Map<string, number>(
      countRows.map(row => [row.column_id, Number(row.total)]),
    );
    for (const column of columns) {
      map.set(column.board_id, [
        ...(map.get(column.board_id) ?? []),
        {
          columnId: column.id,
          title: column.title,
          color: column.color ?? undefined,
          count: counts.get(column.id) ?? 0,
        },
      ]);
    }
    return map;
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
      const previous = (await this.entityRefsByBoard([boardId])).get(boardId);
      await this.knex.transaction(async trx => {
        await trx('board_entities').where('board_id', boardId).delete();
        if (refs.length > 0) {
          await trx('board_entities').insert(
            refs.map(ref => ({ board_id: boardId, entity_ref: ref })),
          );
        }
      });
      // both sides: entities that lost the board and entities that gained it
      this.notifyEntityRefsChanged(previous ?? [], refs);
    }
    if (update.visibility !== undefined) {
      if (!ALL_VISIBILITIES.includes(update.visibility)) {
        throw new InputError(`Invalid visibility '${update.visibility}'`);
      }
      patch.visibility = update.visibility;
    }
    await this.knex('boards').where('id', boardId).update(patch);
    await this.emitBoardSignal(boardId);
    return this.getBoard(principal, boardId);
  }

  /** Archives a board; it stays reachable read-only for admins until purged. */
  async deleteBoard(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<void> {
    await this.requireBoard(principal, boardId, 'admin');
    const refs = (await this.entityRefsByBoard([boardId])).get(boardId) ?? [];
    await this.knex('boards')
      .where('id', boardId)
      .update({
        archived_at: now(),
        archived_by: actorRef(principal),
        updated_at: now(),
      });
    this.notifyEntityRefsChanged(refs);
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
    const refs = (await this.entityRefsByBoard([boardId])).get(boardId) ?? [];
    await this.cascadeDeleteBoards([boardId]);
    this.notifyEntityRefsChanged(refs);
    await this.emitBoardSignal(boardId);
  }

  /** Restores an archived board to its normal listed, writable state. */
  async unarchiveBoard(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<void> {
    const { board } = await this.requireBoard(principal, boardId, 'read');
    const level = await this.effectiveLevel(principal, board);
    if (!levelIncludes(level, 'admin')) {
      throw new NotAllowedError('Unarchiving a board requires admin access');
    }
    if (!board.archived_at) {
      throw new ConflictError('Board is not archived');
    }
    await this.knex('boards').where('id', boardId).update({
      archived_at: null,
      archived_by: null,
      updated_at: now(),
    });
    this.notifyEntityRefsChanged(
      (await this.entityRefsByBoard([boardId])).get(boardId) ?? [],
    );
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
    const ids = rows.map(row => row.id);
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
   * Duplicates a board, optionally copying its columns, items, entity
   * references and share settings. Items can only be copied together with
   * their columns; share settings can only be copied by admins of the
   * source board.
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
    const { board, level } = await this.requireBoard(
      principal,
      boardId,
      'read',
    );
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
    const sourceColumns = await this.knex('board_columns')
      .where('board_id', boardId)
      .orderBy('position');
    const sourcePriorities = await this.priorityRows(boardId);
    const created = await this.createBoard(principal, {
      name: options.name?.trim() || `${board.name} (copy)`,
      columns: options.copyColumns
        ? sourceColumns.map(column => column.title)
        : undefined,
      // priorities travel with the columns: an empty source list stays
      // empty rather than falling back to the defaults
      priorities: options.copyColumns
        ? sourcePriorities.map(priority => ({
            name: priority.name,
            color: priority.color ?? undefined,
          }))
        : undefined,
      entityRefs: options.copyEntities
        ? (await this.entityRefsByBoard([boardId])).get(boardId)
        : undefined,
      visibility: options.copyPermissions ? board.visibility : 'private',
    });
    if (board.description) {
      // the current text only: the copy starts its own history,
      // attributed to the duplicator
      await this.knex('boards')
        .where('id', created.id)
        .update({ description: board.description });
      await this.knex('board_description_versions').insert({
        id: uuid(),
        board_id: created.id,
        text: board.description,
        edited_by: actorRef(principal),
        edited_at: now(),
      });
    }
    if (options.copyColumns) {
      // carry over colors and WIP limits, matching source order to
      // created order
      const newColumns = await this.knex('board_columns')
        .where('board_id', created.id)
        .orderBy('position');
      for (let index = 0; index < newColumns.length; index += 1) {
        const source = sourceColumns[index];
        if (
          source &&
          (source.color ||
            source.wip_soft_limit !== null ||
            source.wip_hard_limit !== null)
        ) {
          await this.knex('board_columns')
            .where('id', newColumns[index].id)
            .update({
              color: source.color,
              wip_soft_limit: source.wip_soft_limit,
              wip_hard_limit: source.wip_hard_limit,
            });
        }
      }
      if (options.copyItems) {
        await this.copyItemsInto(
          principal,
          boardId,
          created.id,
          sourceColumns,
          newColumns,
          sourcePriorities,
          await this.priorityRows(created.id),
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
    sourcePriorities: PriorityRow[] = [],
    targetPriorities: PriorityRow[] = [],
  ): Promise<void> {
    const actor = actorRef(principal);
    const timestamp = now();
    const items = await this.knex('items')
      .where('board_id', sourceBoardId)
      .whereNull('archived_at');
    const itemIds = items.map(item => item.id);
    const [assignees, tags, checklistEntries] = await Promise.all([
      this.knex('item_assignees').whereIn('item_id', itemIds),
      this.knex('item_tags').whereIn('item_id', itemIds),
      this.knex('item_checklist_entries').whereIn('item_id', itemIds),
    ]);
    const columnIdMap = new Map<string, string>();
    sourceColumns.forEach((column, index) => {
      const target = targetColumns[index];
      if (target) {
        columnIdMap.set(column.id, target.id);
      }
    });
    const priorityIdMap = new Map<string, string>();
    sourcePriorities.forEach((priority, index) => {
      const target = targetPriorities[index];
      if (target) {
        priorityIdMap.set(priority.id, target.id);
      }
    });
    await this.knex.transaction(async trx => {
      for (const item of items) {
        const targetColumnId = columnIdMap.get(item.column_id);
        if (!targetColumnId) {
          continue;
        }
        const newId = uuid();
        await trx('items').insert({
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
          priority_id: item.priority_id
            ? priorityIdMap.get(item.priority_id) ?? null
            : null,
        });
        const links = <TRow extends { item_id: string }>(rows: TRow[]) =>
          rows
            .filter(row => row.item_id === item.id)
            .map(row => ({ ...row, item_id: newId }));
        const newAssignees = links(assignees);
        if (newAssignees.length > 0) {
          await trx('item_assignees').insert(newAssignees);
        }
        const newTags = links(tags);
        if (newTags.length > 0) {
          await trx('item_tags').insert(newTags);
        }
        const newChecklistEntries = links(checklistEntries);
        if (newChecklistEntries.length > 0) {
          await trx('item_checklist_entries').insert(newChecklistEntries);
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
    const existing = await this.knex('board_permissions')
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
    const row = await this.knex('board_permissions')
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
    const row = await this.knex('board_permissions')
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
    options: {
      title: string;
      position?: number;
      color?: string;
      wipSoftLimit?: number;
      wipHardLimit?: number;
    },
  ): Promise<BoardColumn> {
    await this.requireBoard(principal, boardId, 'write');
    const title = options.title?.trim();
    if (!title) {
      throw new InputError('Column title must not be empty');
    }
    const color = options.color ? parseColumnColor(options.color) : null;
    const wipSoftLimit =
      options.wipSoftLimit !== undefined
        ? parseWipLimit(options.wipSoftLimit, 'Soft WIP limit')
        : null;
    const wipHardLimit =
      options.wipHardLimit !== undefined
        ? parseWipLimit(options.wipHardLimit, 'Hard WIP limit')
        : null;
    requireSoftAtMostHard(wipSoftLimit, wipHardLimit);
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
      color,
      wip_soft_limit: wipSoftLimit,
      wip_hard_limit: wipHardLimit,
    };
    await this.knex('board_columns').insert(row);
    await this.emitBoardSignal(boardId);
    return toColumn(row);
  }

  async updateColumn(
    principal: BoardsPrincipal,
    boardId: string,
    columnId: string,
    update: {
      title?: string;
      position?: number;
      color?: string | null;
      wipSoftLimit?: number | null;
      wipHardLimit?: number | null;
    },
  ): Promise<BoardColumn> {
    await this.requireBoard(principal, boardId, 'write');
    const row = await this.knex('board_columns')
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
      patch.color = update.color ? parseColumnColor(update.color) : null;
    }
    if (update.wipSoftLimit !== undefined) {
      patch.wip_soft_limit =
        update.wipSoftLimit === null
          ? null
          : parseWipLimit(update.wipSoftLimit, 'Soft WIP limit');
    }
    if (update.wipHardLimit !== undefined) {
      patch.wip_hard_limit =
        update.wipHardLimit === null
          ? null
          : parseWipLimit(update.wipHardLimit, 'Hard WIP limit');
    }
    requireSoftAtMostHard(
      patch.wip_soft_limit !== undefined
        ? patch.wip_soft_limit
        : row.wip_soft_limit,
      patch.wip_hard_limit !== undefined
        ? patch.wip_hard_limit
        : row.wip_hard_limit,
    );
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
    const row = await this.knex('board_columns')
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
      const targetRow = await this.knex('board_columns')
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

  // ------------------------------------------------------------ priorities

  private async priorityRows(
    boardId: string,
    trx?: Knex.Transaction,
  ): Promise<PriorityRow[]> {
    return (trx ?? this.knex)('board_priorities')
      .where('board_id', boardId)
      .orderBy('ord');
  }

  /** Rewrites `ord` to 1..n following the given row order. */
  private async renumberPriorities(
    trx: Knex.Transaction,
    rows: PriorityRow[],
  ): Promise<void> {
    for (const [index, row] of rows.entries()) {
      if (row.ord !== index + 1) {
        await trx('board_priorities')
          .where('id', row.id)
          .update({ ord: index + 1 });
      }
    }
  }

  async addPriority(
    principal: BoardsPrincipal,
    boardId: string,
    options: { name: string; color?: string },
  ): Promise<BoardPriority> {
    await this.requireBoard(principal, boardId, 'admin');
    const name = options.name?.trim();
    if (!name) {
      throw new InputError('Priority name must not be empty');
    }
    const color = options.color ? parsePriorityColor(options.color) : null;
    const existing = await this.priorityRows(boardId);
    if (existing.length >= MAX_PRIORITIES) {
      throw new InputError(
        `A board can define at most ${MAX_PRIORITIES} priorities`,
      );
    }
    const row: PriorityRow = {
      id: uuid(),
      board_id: boardId,
      name,
      color,
      ord: existing.length + 1,
    };
    await this.knex('board_priorities').insert(row);
    await this.emitBoardSignal(boardId);
    return toPriority(row);
  }

  async updatePriority(
    principal: BoardsPrincipal,
    boardId: string,
    priorityId: string,
    update: { name?: string; color?: string | null; order?: number },
  ): Promise<BoardPriority> {
    await this.requireBoard(principal, boardId, 'admin');
    const rows = await this.priorityRows(boardId);
    const row = rows.find(entry => entry.id === priorityId);
    if (!row) {
      throw new NotFoundError(`Priority ${priorityId} not found`);
    }
    const patch: Partial<PriorityRow> = {};
    if (update.name !== undefined) {
      const name = update.name.trim();
      if (!name) {
        throw new InputError('Priority name must not be empty');
      }
      patch.name = name;
    }
    if (update.color !== undefined) {
      patch.color = update.color ? parsePriorityColor(update.color) : null;
    }
    let reordered = rows;
    if (update.order !== undefined) {
      if (
        !Number.isInteger(update.order) ||
        update.order < 1 ||
        update.order > rows.length
      ) {
        throw new InputError(
          `Invalid priority order '${update.order}', expected 1..${rows.length}`,
        );
      }
      reordered = rows.filter(entry => entry.id !== priorityId);
      reordered.splice(update.order - 1, 0, row);
    }
    await this.knex.transaction(async trx => {
      if (Object.keys(patch).length > 0) {
        await trx('board_priorities').where('id', priorityId).update(patch);
      }
      await this.renumberPriorities(trx, reordered);
    });
    await this.emitBoardSignal(boardId);
    const updated = (await this.priorityRows(boardId)).find(
      entry => entry.id === priorityId,
    );
    return toPriority(updated ?? { ...row, ...patch });
  }

  /**
   * Deletes a priority definition. When items — archived ones included —
   * still use it, the caller must choose: reassign them to another of the
   * board's priorities or drop the priority from them.
   */
  async deletePriority(
    principal: BoardsPrincipal,
    boardId: string,
    priorityId: string,
    options?: { reassignTo?: string; drop?: boolean },
  ): Promise<void> {
    await this.requireBoard(principal, boardId, 'admin');
    const rows = await this.priorityRows(boardId);
    const row = rows.find(entry => entry.id === priorityId);
    if (!row) {
      throw new NotFoundError(`Priority ${priorityId} not found`);
    }
    const itemCount = Number(
      (
        await this.knex('items')
          .where('priority_id', priorityId)
          .count({ count: '*' })
          .first()
      )?.count ?? 0,
    );
    let reassignTo: string | null = null;
    if (itemCount > 0) {
      if (options?.reassignTo) {
        if (options.reassignTo === priorityId) {
          throw new InputError(
            'Target priority must differ from the deleted one',
          );
        }
        if (!rows.some(entry => entry.id === options.reassignTo)) {
          throw new NotFoundError(
            `Target priority ${options.reassignTo} not found`,
          );
        }
        reassignTo = options.reassignTo;
      } else if (!options?.drop) {
        throw new ConflictError(
          'Priority is still used by items; choose to reassign or drop it',
        );
      }
    }
    await this.knex.transaction(async trx => {
      if (itemCount > 0) {
        await trx('items')
          .where('priority_id', priorityId)
          .update({ priority_id: reassignTo });
      }
      await trx('board_priorities').where('id', priorityId).delete();
      await this.renumberPriorities(
        trx,
        rows.filter(entry => entry.id !== priorityId),
      );
    });
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
    const tags = await this.knex('item_tags')
      .whereIn('item_id', ids)
      .select('item_id', 'tag');
    const checklistEntries = await this.knex('item_checklist_entries')
      .whereIn('item_id', ids)
      .orderBy('position')
      .select('item_id', 'position', 'text', 'checked');
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
      priorityId: row.priority_id ?? undefined,
      assignees: assignees
        .filter(a => a.item_id === row.id)
        .map(a => a.assignee_ref),
      tags: tags.filter(t => t.item_id === row.id).map(t => t.tag),
      checklist: checklistEntries
        .filter(entry => entry.item_id === row.id)
        .map(entry => ({ text: entry.text, checked: !!entry.checked })),
      watching: watchedIds.has(row.id),
    }));
  }

  async listItems(
    principal: BoardsPrincipal,
    boardId: string,
    filter?: ItemFilter,
  ): Promise<BoardItem[]> {
    await this.requireBoard(principal, boardId, 'read');
    const query = this.knex('items')
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
    // one whereExists over all of them: tags are all-of, assignees any-of
    const assignees = filter?.assignees ?? [];
    if (assignees.length > 0) {
      query.whereExists(builder =>
        builder
          .select('*')
          .from('item_assignees')
          .whereRaw('item_assignees.item_id = items.id')
          .whereIn('item_assignees.assignee_ref', assignees),
      );
    }
    const priorities = filter?.priorities ?? [];
    if (priorities.length > 0) {
      query.whereIn('items.priority_id', priorities);
    }
    if (filter?.overdue) {
      // plain string comparison is correct: due dates are `YYYY-MM-DD`
      query.where('items.due_date', '<', todayISO());
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
      throw new NotAllowedError('Listing your items requires a logged-in user');
    }
    const refs = [...new Set([principal.userRef, ...principal.ownershipRefs])];
    const itemIds = (
      await this.knex('item_assignees')
        .whereIn('assignee_ref', refs)
        .select('item_id')
    ).map(row => row.item_id);
    if (itemIds.length === 0) {
      return [];
    }
    const rows = await this.knex('items')
      .whereIn('id', itemIds)
      .whereNull('archived_at');
    const boardIds = [...new Set(rows.map(row => row.board_id))];
    const boards = await this.knex('boards')
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
    const columns = await this.knex('board_columns').whereIn('id', [
      ...new Set(visible.map(row => row.column_id)),
    ]);
    const columnTitles = new Map(columns.map(col => [col.id, col.title]));
    const priorityIds = [
      ...new Set(visible.flatMap(row => row.priority_id ?? [])),
    ];
    const priorityRows =
      priorityIds.length > 0
        ? await this.knex('board_priorities').whereIn('id', priorityIds)
        : [];
    const prioritiesById = new Map(
      priorityRows.map(row => [row.id, toPriority(row)]),
    );
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
            priority: row.priority_id
              ? prioritiesById.get(row.priority_id)
              : undefined,
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
    const row = await this.knex('items')
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

  /**
   * Rejects putting one more item into a column whose non-archived item
   * count has reached its hard WIP limit.
   */
  private async requireWipCapacity(column: ColumnRow): Promise<void> {
    if (column.wip_hard_limit === null) {
      return;
    }
    const count = Number(
      (
        await this.knex('items')
          .where('column_id', column.id)
          .whereNull('archived_at')
          .count({ count: '*' })
          .first()
      )?.count ?? 0,
    );
    if (count >= column.wip_hard_limit) {
      throw new ConflictError(
        `Column "${column.title}" is at its WIP limit of ${column.wip_hard_limit}`,
      );
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
    const column = await this.knex('board_columns')
      .where({ id: item.columnId, board_id: boardId })
      .first();
    if (!column) {
      throw new NotFoundError(`Column ${item.columnId} not found`);
    }
    await this.requireWipCapacity(column);
    this.validateActorRefs([
      ...(item.creatorRef ? [item.creatorRef] : []),
      ...(item.assignees ?? []),
    ]);
    if (item.priorityId) {
      await this.requirePriority(boardId, item.priorityId);
    }
    const checklist =
      item.checklist !== undefined
        ? normalizeChecklist(item.checklist)
        : undefined;

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
      await trx('items').insert({
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
        priority_id: item.priorityId ?? null,
      });
      await this.writeAssociations(trx, itemId, { ...item, checklist });
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
    item: {
      assignees?: string[];
      tags?: string[];
      checklist?: ChecklistEntry[];
    },
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
    if (item.tags !== undefined) {
      await trx('item_tags').where('item_id', itemId).delete();
      const tags = normalizeTags(item.tags);
      if (tags.length > 0) {
        await trx('item_tags').insert(
          tags.map(tag => ({ item_id: itemId, tag })),
        );
      }
    }
    if (item.checklist !== undefined) {
      await trx('item_checklist_entries').where('item_id', itemId).delete();
      if (item.checklist.length > 0) {
        await trx('item_checklist_entries').insert(
          item.checklist.map((entry, position) => ({
            item_id: itemId,
            position,
            text: entry.text,
            checked: entry.checked,
          })),
        );
      }
    }
  }

  /** Loads a priority and asserts it belongs to the given board. */
  private async requirePriority(
    boardId: string,
    priorityId: string,
  ): Promise<PriorityRow> {
    const row = await this.knex('board_priorities')
      .where({ id: priorityId, board_id: boardId })
      .first();
    if (!row) {
      throw new InputError(
        `Priority ${priorityId} does not belong to this board`,
      );
    }
    return row;
  }

  private async requireMutableItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    options?: { allowArchived?: boolean },
  ): Promise<ItemRow> {
    await this.requireBoard(principal, boardId, 'write');
    const row = await this.knex('items')
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
        changes.push({
          field: 'description',
          oldValue: undefined,
          newValue: undefined,
        });
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
        throw new InputError(`Invalid due date '${next}', expected YYYY-MM-DD`);
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
    let checklist: ChecklistEntry[] | undefined;
    if (update.checklist !== undefined) {
      const next = normalizeChecklist(update.checklist);
      if (JSON.stringify(next) !== JSON.stringify(before.checklist)) {
        checklist = next;
        changes.push({
          field: 'checklist',
          oldValue: before.checklist,
          newValue: next,
        });
      }
    }
    if (update.priorityId !== undefined) {
      const next = update.priorityId;
      if ((next ?? null) !== row.priority_id) {
        // recorded by name: ids go stale once a definition is deleted
        const nextName = next
          ? (await this.requirePriority(boardId, next)).name
          : undefined;
        const prevName = row.priority_id
          ? (
              await this.knex('board_priorities')
                .where('id', row.priority_id)
                .first()
            )?.name
          : undefined;
        patch.priority_id = next ?? null;
        changes.push({
          field: 'priority',
          oldValue: prevName,
          newValue: nextName,
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
        await this.writeAssociations(trx, itemId, { ...update, checklist });
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
            context: `You were mentioned in the description of "${
              patch.title ?? row.title
            }"`,
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

  /**
   * Creates a copy of an item on the same board, directly after the
   * original in its column: fields, tags, assignees, due date,
   * priority, description (as the copy's first version), and the
   * checklist with every entry unchecked. Comments, history, watches,
   * and the external-manager flag stay behind; the duplicator is the
   * creator.
   */
  async duplicateItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
  ): Promise<BoardItem> {
    await this.requireBoard(principal, boardId, 'write');
    const row = await this.knex('items')
      .where({ id: itemId, board_id: boardId })
      .whereNull('archived_at')
      .first();
    if (!row) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const [tags, assignees, checklist] = await Promise.all([
      this.knex('item_tags').where('item_id', itemId),
      this.knex('item_assignees').where('item_id', itemId),
      this.knex('item_checklist_entries')
        .where('item_id', itemId)
        .orderBy('position'),
    ]);
    // land directly after the original: halfway to the next item
    const next = await this.knex('items')
      .where('column_id', row.column_id)
      .whereNull('archived_at')
      .where('position', '>', row.position)
      .orderBy('position')
      .first();
    const position = next
      ? (row.position + next.position) / 2
      : row.position + POSITION_STEP;
    const copy = await this.createItem(principal, boardId, {
      columnId: row.column_id,
      title: `${row.title} (copy)`,
      position,
      tags: tags.map(entry => entry.tag),
      assignees: assignees.map(entry => entry.assignee_ref),
      priorityId: row.priority_id ?? undefined,
      checklist: checklist.map(entry => ({
        text: entry.text,
        checked: false,
      })),
    });
    if (row.description || row.due_date) {
      const timestamp = now();
      await this.knex.transaction(async trx => {
        await trx('items').where('id', copy.id).update({
          description: row.description,
          due_date: row.due_date,
        });
        if (row.description) {
          await trx('item_description_versions').insert({
            id: uuid(),
            item_id: copy.id,
            text: row.description,
            edited_by: actorRef(principal),
            edited_at: timestamp,
          });
        }
      });
      await this.emitBoardSignal(boardId, copy.id);
    }
    return this.getItem(principal, boardId, copy.id);
  }

  async moveItem(
    principal: BoardsPrincipal,
    boardId: string,
    itemId: string,
    target: { columnId: string; position?: number },
  ): Promise<BoardItem> {
    const row = await this.requireMutableItem(principal, boardId, itemId);
    const targetColumn = await this.knex('board_columns')
      .where({ id: target.columnId, board_id: boardId })
      .first();
    if (!targetColumn) {
      throw new NotFoundError(`Column ${target.columnId} not found`);
    }
    if (row.column_id !== target.columnId) {
      await this.requireWipCapacity(targetColumn);
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
        const oldColumn = await trx('board_columns')
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
    const rows = await this.knex('items')
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
    const ids = rows.map(row => row.id);
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
    const item = await this.knex('items')
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
  ): Promise<{ comment: CommentRow; itemTitle: string }> {
    const { board, level } = await this.requireBoard(
      principal,
      boardId,
      'write',
    );
    const item = await this.knex('items')
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
    const item = await this.knex('items')
      .where({ id: itemId, board_id: boardId })
      .first();
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }
    const commentRows = await this.knex('comments').where('item_id', itemId);
    const comments = await this.hydrateComments(commentRows.map(row => row.id));
    const changeRows = await this.knex('changes').where('item_id', itemId);
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

  /**
   * Server-computed flow aggregates: cycle time per column, cumulative
   * flow (30 days), and throughput into the last column (8 weeks),
   * reconstructed from the recorded status moves. Moves store column
   * titles, so intervals are mapped to current columns by title;
   * intervals whose title no longer resolves are dropped.
   */
  async getBoardInsights(
    principal: BoardsPrincipal,
    boardId: string,
  ): Promise<BoardInsights> {
    await this.requireBoard(principal, boardId, 'read');
    const columns = await this.knex('board_columns')
      .where('board_id', boardId)
      .orderBy('position');
    const columnByTitle = new Map<string, ColumnRow>();
    for (const column of columns) {
      if (!columnByTitle.has(column.title)) {
        columnByTitle.set(column.title, column);
      }
    }
    const items = await this.knex('items').where('board_id', boardId);
    const moves = await this.knex('changes')
      .where({ board_id: boardId, type: 'moved', field: 'status' })
      .orderBy('at');
    // change values are stored JSON-encoded (see recordChange)
    const titleOf = (value: string | null): string => {
      if (value === null) {
        return '';
      }
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'string' ? parsed : '';
      } catch {
        return value;
      }
    };
    const movesByItem = new Map<string, ChangeRow[]>();
    for (const move of moves) {
      const list = movesByItem.get(move.item_id) ?? [];
      list.push(move);
      movesByItem.set(move.item_id, list);
    }

    // one interval per stay: [title, start, end); end undefined = still
    // there (or until archival, tracked separately for the flow chart)
    type Stay = { title: string; start: number; end?: number };
    const stays: Array<{
      item: (typeof items)[number];
      intervals: Stay[];
    }> = [];
    for (const item of items) {
      const itemMoves = movesByItem.get(item.id) ?? [];
      const intervals: Stay[] = [];
      let currentTitle =
        itemMoves.length > 0
          ? titleOf(itemMoves[0].old_value)
          : columns.find(column => column.id === item.column_id)?.title ?? '';
      let start = Date.parse(item.created_at);
      for (const move of itemMoves) {
        const at = Date.parse(move.at);
        intervals.push({ title: currentTitle, start, end: at });
        currentTitle = titleOf(move.new_value);
        start = at;
      }
      intervals.push({ title: currentTitle, start });
      stays.push({ item, intervals });
    }

    const cycleTimes: ColumnCycleTime[] = columns.map(column => {
      const durations = stays
        .flatMap(entry => entry.intervals)
        .filter(stay => stay.end !== undefined && stay.title === column.title)
        .map(stay => (stay.end! - stay.start) / 3_600_000)
        .sort((a, b) => a - b);
      const total = durations.reduce((sum, hours) => sum + hours, 0);
      let median = 0;
      if (durations.length % 2 === 1) {
        median = durations[(durations.length - 1) / 2];
      } else if (durations.length > 0) {
        median =
          (durations[durations.length / 2 - 1] +
            durations[durations.length / 2]) /
          2;
      }
      return {
        columnId: column.id,
        title: column.title,
        color: column.color ?? undefined,
        stays: durations.length,
        averageHours: durations.length === 0 ? 0 : total / durations.length,
        medianHours: median,
      };
    });

    const dayMs = 24 * 3_600_000;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const cumulativeFlow: FlowDay[] = [];
    for (let back = 29; back >= 0; back -= 1) {
      const instant = endOfToday.getTime() - back * dayMs;
      const counts: Record<string, number> = {};
      for (const column of columns) {
        counts[column.id] = 0;
      }
      for (const { item, intervals } of stays) {
        if (Date.parse(item.created_at) > instant) {
          continue;
        }
        if (item.archived_at && Date.parse(item.archived_at) <= instant) {
          continue;
        }
        const stay = intervals.find(
          entry =>
            entry.start <= instant &&
            (entry.end === undefined || entry.end > instant),
        );
        const column = stay ? columnByTitle.get(stay.title) : undefined;
        if (column) {
          counts[column.id] = (counts[column.id] ?? 0) + 1;
        }
      }
      cumulativeFlow.push({
        date: todayISO(new Date(instant)),
        counts,
      });
    }

    // Monday of the ISO week the timestamp falls into
    const weekStartOf = (timestamp: number): string => {
      const date = new Date(timestamp);
      date.setHours(0, 0, 0, 0);
      const day = (date.getDay() + 6) % 7;
      return todayISO(new Date(date.getTime() - day * dayMs));
    };
    const lastColumnTitle = columns[columns.length - 1]?.title;
    const arrivalWeeks = new Map<string, number>();
    for (const move of moves) {
      if (lastColumnTitle && titleOf(move.new_value) === lastColumnTitle) {
        const week = weekStartOf(Date.parse(move.at));
        arrivalWeeks.set(week, (arrivalWeeks.get(week) ?? 0) + 1);
      }
    }
    const throughput: ThroughputWeek[] = [];
    const thisWeek = weekStartOf(Date.now());
    for (let back = 7; back >= 0; back -= 1) {
      const weekStart = todayISO(
        new Date(Date.parse(`${thisWeek}T00:00:00`) - back * 7 * dayMs),
      );
      throughput.push({ weekStart, count: arrivalWeeks.get(weekStart) ?? 0 });
    }

    return {
      columns: columns.map(column => ({
        columnId: column.id,
        title: column.title,
        color: column.color ?? undefined,
      })),
      cycleTimes,
      cumulativeFlow,
      throughput,
      moveCount: moves.length,
    };
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
      .where({
        user_ref: userRef,
        target_type: targetType,
        target_id: targetId,
      })
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
    return rows.map(row => row.user_ref);
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
    return rows.map(row => row.user_ref);
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
    return [...new Set(rows.map(row => row.user_ref))].filter(
      ref => ref !== actor && !isTextRef(ref),
    );
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
      type: ChangeType;
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

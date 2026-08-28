/**
 * Visibility of a board beyond explicit user/group grants.
 *
 * - `private`: only explicit grants
 * - `logged-in-read` / `logged-in-write`: any authenticated user may read/write
 * - `public-read` / `public-write`: anyone, including unauthenticated requests
 */
export type BoardVisibility =
  | 'private'
  | 'logged-in-read'
  | 'logged-in-write'
  | 'public-read'
  | 'public-write';

export type BoardPermissionLevel = 'read' | 'write' | 'admin';

export interface BoardColumn {
  id: string;
  boardId: string;
  title: string;
  position: number;
  /** Named palette color (see COLUMN_COLORS); undefined = neutral. */
  color?: ColumnColor;
}

/** Every column colour, in palette order. */
export const ALL_COLUMN_COLORS = [
  'gray',
  'blue',
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'teal',
] as const;

export type ColumnColor = (typeof ALL_COLUMN_COLORS)[number];

/** Fixed palette for column colors (name -> hex). */
export const COLUMN_COLORS: Record<ColumnColor, string> = {
  gray: '#8a8f98',
  blue: '#3b82f6',
  green: '#22a06b',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  teal: '#14b8a6',
};

/**
 * One of a board's priority definitions. Items reference a priority by
 * id, so renaming or recoloring never touches items.
 */
export interface BoardPriority {
  id: string;
  boardId: string;
  name: string;
  /** Named palette color (see COLUMN_COLORS); undefined = neutral. */
  color?: ColumnColor;
  /** 1-based order; 1 is the highest priority. Always contiguous. */
  order: number;
}

/** A board can define at most this many priorities. */
export const MAX_PRIORITIES = 10;

export interface Board {
  id: string;
  name: string;
  /** Catalog entities this board references (e.g. a component and a team). */
  entityRefs: string[];
  visibility: BoardVisibility;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Set while the board is archived (read-only, purged after 30 days). */
  archivedAt?: string;
  archivedBy?: string;
}

/** A board as returned to a specific user, with per-user context. */
export interface BoardWithContext extends Board {
  columns: BoardColumn[];
  /** Priority definitions ordered by `order`; empty = feature unused. */
  priorities: BoardPriority[];
  access: BoardPermissionLevel;
  favorite: boolean;
  watching: boolean;
}

/** One column of a board with the number of items sitting in it. */
export interface BoardStatusCount {
  columnId: string;
  title: string;
  color?: ColumnColor;
  /** Non-archived items in this column; 0 when the column is empty. */
  count: number;
}

export interface BoardListEntry extends Board {
  access: BoardPermissionLevel;
  favorite: boolean;
  /**
   * Per-column item counts, in column order. Present only when the
   * listing was requested with counts.
   */
  statusCounts?: BoardStatusCount[];
}

/**
 * The filters a board listing can be narrowed by. They combine with AND:
 * a board is listed only if it satisfies every field that is set.
 *
 * `search` matches the board name case-insensitively; `entityRef` matches
 * boards referencing that catalog entity; `createdBy` matches the board's
 * creator ref exactly.
 */
export interface BoardListFilter {
  search?: string;
  entityRef?: string;
  createdBy?: string;
  favoritesOnly?: boolean;
}

/** The largest page a board listing will return. */
export const MAX_BOARD_PAGE_SIZE = 100;

/**
 * One page of a board listing. `total` counts every board matching the
 * request, not the page — so it is what a pagination control counts
 * against. A listing requested without a `limit` returns every match and
 * carries no `limit`/`offset`.
 */
export interface BoardListResult {
  boards: BoardListEntry[];
  total: number;
  limit?: number;
  offset?: number;
}

/**
 * The options offered by the board list's filter dropdowns, derived from
 * the boards the caller can read and from nothing else: `entityRefs` are
 * the entities those boards reference and `creators` the users who
 * created them. `total` is how many boards the caller can read at all,
 * independent of any filter they currently have applied.
 */
export interface BoardFilterOptions {
  total: number;
  entityRefs: string[];
  creators: string[];
}

export interface BoardPermissionEntry {
  id: string;
  boardId: string;
  /** `user:...` or `group:...` entity ref */
  principalRef: string;
  level: BoardPermissionLevel;
}

/** One entry of an item's checklist. */
export interface ChecklistEntry {
  text: string;
  checked: boolean;
}

export interface BoardItem {
  id: string;
  boardId: string;
  columnId: string;
  position: number;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  creatorRef?: string;
  /** Set when the item is managed by an external system (e.g. `github`); such items are read-only for users. */
  externalManager?: string;
  /** Markdown description; same subset and auto-linking as comments. */
  description?: string;
  /** Number of stored description versions (0 = never set). */
  descriptionVersionCount: number;
  /** Set while the item is archived (soft-deleted, restorable for 30 days). */
  archivedAt?: string;
  archivedBy?: string;
  assignees: string[];
  tags: string[];
  /** Optional due date as a plain `YYYY-MM-DD` calendar date. */
  dueDate?: string;
  /** Id of one of the board's priorities, when set. */
  priorityId?: string;
  /** Ordered checklist entries; empty when the item has no checklist. */
  checklist: ChecklistEntry[];
  watching?: boolean;
}

export interface ItemComment {
  id: string;
  itemId: string;
  authorRef: string;
  createdAt: string;
  /** Current text (latest version). */
  text: string;
  editedBy?: string;
  editedAt?: string;
  versionCount: number;
}

export interface CommentVersion {
  id: string;
  commentId: string;
  text: string;
  editedBy: string;
  editedAt: string;
}

export type ChangeType =
  | 'created'
  | 'updated'
  | 'moved'
  | 'deleted'
  | 'archived'
  | 'restored';

export interface ChangeRecord {
  id: string;
  itemId: string;
  boardId: string;
  actorRef: string;
  at: string;
  type: ChangeType;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface BoardChangeEntry {
  change: ChangeRecord;
  itemTitle: string;
}

export type TimelineEntry =
  | { kind: 'comment'; at: string; comment: ItemComment }
  | { kind: 'change'; at: string; change: ChangeRecord };

/** An item of the current user together with its board context. */
export interface MyBoardItem {
  item: BoardItem;
  boardId: string;
  boardName: string;
  columnTitle: string;
  /** The item's priority resolved against its board, when set. */
  priority?: BoardPriority;
}

export interface NewItem {
  columnId: string;
  title: string;
  position?: number;
  creatorRef?: string;
  assignees?: string[];
  tags?: string[];
  priorityId?: string;
  checklist?: ChecklistEntry[];
  externalManager?: string;
}

export interface ItemUpdate {
  title?: string;
  creatorRef?: string | null;
  /** New description text; an empty string clears the description. */
  description?: string;
  assignees?: string[];
  tags?: string[];
  /** New due date as `YYYY-MM-DD`, or null to clear it. */
  dueDate?: string | null;
  /** Id of one of the board's priorities, or null to clear it. */
  priorityId?: string | null;
  /** Replaces the full checklist; an empty array clears it. */
  checklist?: ChecklistEntry[];
}

export interface BoardUpdate {
  name?: string;
  /** Replaces the full list of referenced catalog entities. */
  entityRefs?: string[];
  visibility?: BoardVisibility;
}

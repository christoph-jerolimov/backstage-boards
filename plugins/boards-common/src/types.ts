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

export type ColumnColor =
  | 'gray'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'teal';

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

export interface Board {
  id: string;
  name: string;
  entityRef?: string;
  visibility: BoardVisibility;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A board as returned to a specific user, with per-user context. */
export interface BoardWithContext extends Board {
  columns: BoardColumn[];
  access: BoardPermissionLevel;
  favorite: boolean;
  watching: boolean;
}

export interface BoardListEntry extends Board {
  access: BoardPermissionLevel;
  favorite: boolean;
}

export interface BoardPermissionEntry {
  id: string;
  boardId: string;
  /** `user:...` or `group:...` entity ref */
  principalRef: string;
  level: BoardPermissionLevel;
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
  labels: Record<string, string>;
  tags: string[];
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

export interface NewItem {
  columnId: string;
  title: string;
  position?: number;
  creatorRef?: string;
  assignees?: string[];
  labels?: Record<string, string>;
  tags?: string[];
  externalManager?: string;
}

export interface ItemUpdate {
  title?: string;
  creatorRef?: string | null;
  /** New description text; an empty string clears the description. */
  description?: string;
  assignees?: string[];
  labels?: Record<string, string>;
  tags?: string[];
}

export interface BoardUpdate {
  name?: string;
  entityRef?: string | null;
  visibility?: BoardVisibility;
}

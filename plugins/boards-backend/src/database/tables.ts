import { Knex } from 'knex';
import {
  BoardPermissionLevel,
  BoardVisibility,
  ChangeType,
  ColumnColor,
} from '@internal/plugin-boards-common';

/**
 * The row shapes of every table this plugin owns, registered with knex so
 * that `knex('items')` — selects, inserts and updates alike — is checked
 * against the schema created in `./migrations` instead of falling back to
 * `any`.
 *
 * Columns holding one of the shared unions (`visibility`, `level`, `color`,
 * a change `type`) are typed as that union: the service validates every
 * value on the way in, so the schema is the single place that says what a
 * column may hold.
 */

export interface BoardRow {
  id: string;
  name: string;
  visibility: BoardVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
}

export interface BoardEntityRow {
  board_id: string;
  entity_ref: string;
}

export interface ColumnRow {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: ColumnColor | null;
}

export interface PriorityRow {
  id: string;
  board_id: string;
  name: string;
  color: ColumnColor | null;
  /** 1-based contiguous order; 1 is the highest priority. */
  ord: number;
}

export interface PermissionRow {
  id: string;
  board_id: string;
  principal_ref: string;
  level: BoardPermissionLevel;
}

export interface ItemRow {
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
  priority_id: string | null;
}

export interface ItemAssigneeRow {
  item_id: string;
  assignee_ref: string;
}

export interface ItemTagRow {
  item_id: string;
  tag: string;
}

export interface CommentRow {
  id: string;
  item_id: string;
  author_ref: string;
  created_at: string;
}

export interface CommentVersionRow {
  id: string;
  comment_id: string;
  text: string;
  edited_by: string;
  edited_at: string;
}

export interface ItemDescriptionVersionRow {
  id: string;
  item_id: string;
  text: string;
  edited_by: string;
  edited_at: string;
}

export interface ChangeRow {
  id: string;
  item_id: string;
  board_id: string;
  actor_ref: string;
  at: string;
  type: ChangeType;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
}

export interface FavoriteRow {
  user_ref: string;
  board_id: string;
}

/** `target_type` distinguishes a watched board from a watched item. */
export interface WatchRow {
  user_ref: string;
  target_type: 'board' | 'item';
  target_id: string;
}

/**
 * The insert shape of a row: nullable columns may be left out, since the
 * database stores NULL for them anyway.
 */
type Insertable<TRow> = {
  [K in keyof TRow as null extends TRow[K] ? never : K]: TRow[K];
} & {
  [K in keyof TRow as null extends TRow[K] ? K : never]?: TRow[K];
};

/** A table whose inserts may omit nullable columns and whose updates are partial. */
type Table<TRow> = Knex.CompositeTableType<
  TRow,
  Insertable<TRow>,
  Partial<TRow>
>;

declare module 'knex/types/tables' {
  interface Tables {
    boards: Table<BoardRow>;
    board_entities: Table<BoardEntityRow>;
    board_columns: Table<ColumnRow>;
    board_priorities: Table<PriorityRow>;
    board_permissions: Table<PermissionRow>;
    items: Table<ItemRow>;
    item_assignees: Table<ItemAssigneeRow>;
    item_tags: Table<ItemTagRow>;
    comments: Table<CommentRow>;
    comment_versions: Table<CommentVersionRow>;
    item_description_versions: Table<ItemDescriptionVersionRow>;
    changes: Table<ChangeRow>;
    favorites: Table<FavoriteRow>;
    watches: Table<WatchRow>;
  }
}

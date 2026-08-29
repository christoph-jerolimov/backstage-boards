import {
  BoardColumn,
  BoardItem,
  BoardPriority,
  MyBoardItem,
  todayISO,
} from '@internal/plugin-boards-common';

/** The table columns that can be sorted on. */
export const ITEM_SORT_COLUMNS = [
  'title',
  'status',
  'dueDate',
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
] as const;

export interface ItemSortDescriptor {
  column: (typeof ITEM_SORT_COLUMNS)[number];
  direction: 'ascending' | 'descending';
}

/**
 * Narrows the sort descriptor a table hands back — whose column is a bare
 * react-aria `Key` — to a column this table actually sorts on.
 */
export function toItemSortDescriptor(descriptor: {
  column?: unknown;
  direction?: unknown;
}): ItemSortDescriptor | undefined {
  const column = ITEM_SORT_COLUMNS.find(name => name === descriptor.column);
  if (!column) {
    return undefined;
  }
  return {
    column,
    direction:
      descriptor.direction === 'descending' ? 'descending' : 'ascending',
  };
}

/**
 * Client-side sort for the table view. Without a descriptor, board order
 * (position) is kept.
 */
export function sortItems(
  items: BoardItem[],
  descriptor: ItemSortDescriptor | undefined,
  columns: BoardColumn[],
): BoardItem[] {
  if (!descriptor) {
    return items;
  }
  const columnTitle = (columnId: string) =>
    columns.find(column => column.id === columnId)?.title ?? '';
  const key = (item: BoardItem): string => {
    switch (descriptor.column) {
      case 'title':
        return item.title.toLocaleLowerCase('en-US');
      case 'status':
        return columnTitle(item.columnId).toLocaleLowerCase('en-US');
      case 'dueDate':
        // items without a due date sort last in both directions
        return item.dueDate ?? '9999-99-99';
      case 'createdBy':
        return item.createdBy.toLocaleLowerCase('en-US');
      case 'createdAt':
        return item.createdAt;
      case 'updatedBy':
        return item.updatedBy.toLocaleLowerCase('en-US');
      case 'updatedAt':
        return item.updatedAt;
      default:
        return '';
    }
  };
  const factor = descriptor.direction === 'descending' ? -1 : 1;
  return [...items].sort((a, b) => factor * key(a).localeCompare(key(b)));
}

export const UNASSIGNED = 'unassigned';
export const NO_DUE_DATE = 'no-due-date';
export const UNTAGGED = 'untagged';
export const NO_PRIORITY = 'no-priority';

/** How board/table items are grouped. */
/** Every grouping the board and my-items views offer. */
export const ALL_GROUP_BY_MODES = [
  'none',
  'assignee',
  'priority',
  'dueDate',
  'tags',
] as const;

export type GroupByMode = (typeof ALL_GROUP_BY_MODES)[number];

export interface ItemGroup {
  key: string;
  items: BoardItem[];
}

/** The group the items carrying none of the grouped values land in. */
export const REST_KEY: Record<Exclude<GroupByMode, 'none'>, string> = {
  assignee: UNASSIGNED,
  priority: NO_PRIORITY,
  dueDate: NO_DUE_DATE,
  tags: UNTAGGED,
};

/** How that group reads, wherever a grouping is labelled. */
export const REST_LABEL: Record<Exclude<GroupByMode, 'none'>, string> = {
  assignee: 'Unassigned',
  priority: 'No priority',
  dueDate: 'No due date',
  tags: 'Untagged',
};

/** The values an item is grouped under; empty puts it in the rest group. */
function groupKeysOf(item: BoardItem, mode: GroupByMode): string[] {
  switch (mode) {
    case 'assignee':
      return item.assignees;
    case 'priority':
      return item.priorityId ? [item.priorityId] : [];
    case 'dueDate':
      return item.dueDate ? [item.dueDate] : [];
    default:
      return item.tags;
  }
}

/**
 * Groups items by the selected mode. Multi-valued modes (assignee,
 * tags) put an item into each of its groups; the "none of them" group
 * (unassigned / no priority / no due date / untagged) always comes last.
 * Priority groups are keyed by priority id and ordered by the board's
 * priority order (1 first), which is why that mode needs `priorities`.
 */
export function groupItems(
  items: BoardItem[],
  mode: GroupByMode,
  priorities: BoardPriority[] = [],
): ItemGroup[] {
  if (mode === 'none') {
    return [{ key: 'all', items }];
  }
  const groups = new Map<string, BoardItem[]>();
  const rest: BoardItem[] = [];
  for (const item of items) {
    const keys = groupKeysOf(item, mode);
    if (keys.length === 0) {
      rest.push(item);
      continue;
    }
    for (const key of keys) {
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
  }
  const priorityOrder = new Map(priorities.map(p => [p.id, p.order]));
  const result = [...groups.entries()]
    .sort(([a], [b]) =>
      mode === 'priority'
        ? (priorityOrder.get(a) ?? Infinity) -
          (priorityOrder.get(b) ?? Infinity)
        : a.localeCompare(b),
    )
    .map(([key, grouped]) => ({ key, items: grouped }));
  if (rest.length > 0) {
    result.push({ key: REST_KEY[mode], items: rest });
  }
  return result;
}

/**
 * Groups items by assignee. An item with multiple assignees appears in
 * each assignee's group; items without assignees land in the
 * {@link UNASSIGNED} group. Group order: assignees alphabetically, then
 * the unassigned group.
 */
export function groupByAssignee(items: BoardItem[]): ItemGroup[] {
  return groupItems(items, 'assignee');
}

/**
 * The distinct assignees across a set of items — the pool the item
 * menu offers as quick-assign shortcuts.
 */
export function assigneePool(items: Array<{ assignees: string[] }>): string[] {
  return [...new Set(items.flatMap(item => item.assignees))];
}

/** Midpoint position for inserting before the item at `index`. */
export function positionBefore(
  sorted: Array<{ position: number }>,
  index: number,
): number {
  const next = sorted[index]?.position;
  const prev = sorted[index - 1]?.position;
  if (next === undefined) {
    return (prev ?? 0) + 1000;
  }
  if (prev === undefined) {
    return next / 2;
  }
  return (prev + next) / 2;
}

/**
 * How my-items entries are grouped. `board` and `status` are my-items'
 * own; `none`, `dueDate` and `tags` mean the same here as on a board.
 * The home page widget offers `board`, `status` and `dueDate`; the
 * my-items page offers {@link MY_ITEMS_PAGE_GROUP_BY}.
 */
export type MyItemsGroupBy = 'none' | 'board' | 'status' | 'dueDate' | 'tags';

/** The groupings the my-items page offers, in menu order. */
export const MY_ITEMS_PAGE_GROUP_BY = [
  'board',
  'none',
  'dueDate',
  'tags',
] as const;

export interface MyItemGroup {
  /** Stable identity: board id, column title, due date, or tag. */
  key: string;
  label: string;
  entries: MyBoardItem[];
}

/**
 * The entries that are due: due date today or in the past, in the
 * viewer's local timezone. Entries without a due date are not due.
 */
export function filterDueEntries(
  entries: MyBoardItem[],
  now: Date = new Date(),
): MyBoardItem[] {
  const today = todayISO(now);
  // both sides are `YYYY-MM-DD`, so string comparison is date comparison
  return entries.filter(
    entry => !!entry.item.dueDate && entry.item.dueDate <= today,
  );
}

/** The values an entry is grouped under; empty puts it in the rest group. */
function myGroupKeysOf(entry: MyBoardItem, mode: MyItemsGroupBy): string[] {
  switch (mode) {
    case 'board':
      return [entry.boardId];
    case 'status':
      return [entry.columnTitle];
    default:
      // due dates and tags group the same way they do on a board
      return groupKeysOf(entry.item, mode);
  }
}

/** How a group of `mode` reads, given the key and one of its entries. */
function myGroupLabelOf(
  entry: MyBoardItem,
  mode: MyItemsGroupBy,
  key: string,
): string {
  return mode === 'board' ? entry.boardName : key;
}

/**
 * Groups my-items entries. Board and status groups are ordered
 * alphabetically by label; due-date groups run chronologically with the
 * most urgent first and tag groups alphabetically, both with the entries
 * carrying none of the values (no due date / no tags) in a trailing
 * group. An entry with several tags appears in each of their groups.
 * Ungrouped (`none`) yields the single group the caller renders headless.
 */
export function groupMyItems(
  entries: MyBoardItem[],
  mode: MyItemsGroupBy,
): MyItemGroup[] {
  if (mode === 'none') {
    return entries.length > 0 ? [{ key: 'all', label: '', entries }] : [];
  }
  const groups = new Map<string, MyItemGroup>();
  const rest: MyBoardItem[] = [];
  for (const entry of entries) {
    const keys = myGroupKeysOf(entry, mode);
    if (keys.length === 0) {
      rest.push(entry);
      continue;
    }
    for (const key of keys) {
      const group = groups.get(key) ?? {
        key,
        label: myGroupLabelOf(entry, mode, key),
        entries: [],
      };
      group.entries.push(entry);
      groups.set(key, group);
    }
  }
  const result = [...groups.values()].sort((a, b) =>
    // due dates are `YYYY-MM-DD` and tags are their own label, so
    // comparing the key sorts them chronologically resp. alphabetically
    mode === 'board' || mode === 'status'
      ? a.label.localeCompare(b.label)
      : a.key.localeCompare(b.key),
  );
  // only the shared modes can leave an entry without a key: every entry
  // has a board and a status
  if (rest.length > 0 && (mode === 'dueDate' || mode === 'tags')) {
    result.push({
      key: REST_KEY[mode],
      label: REST_LABEL[mode],
      entries: rest,
    });
  }
  return result;
}

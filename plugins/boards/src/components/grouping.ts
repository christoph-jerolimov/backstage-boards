import {
  BoardColumn,
  BoardItem,
  MyBoardItem,
  todayISO,
} from '@internal/plugin-boards-common';

/** The table columns that can be sorted on. */
export const ITEM_SORT_COLUMNS = [
  'title',
  'status',
  'dueDate',
  'createdBy',
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

/** How board/table items are grouped. */
/** Every grouping the board and my-items views offer. */
export const ALL_GROUP_BY_MODES = [
  'none',
  'assignee',
  'dueDate',
  'tags',
] as const;

export type GroupByMode = (typeof ALL_GROUP_BY_MODES)[number];

export interface ItemGroup {
  key: string;
  items: BoardItem[];
}

/** The group the items carrying none of the grouped values land in. */
const REST_KEY: Record<Exclude<GroupByMode, 'none'>, string> = {
  assignee: UNASSIGNED,
  dueDate: NO_DUE_DATE,
  tags: UNTAGGED,
};

/** The values an item is grouped under; empty puts it in the rest group. */
function groupKeysOf(item: BoardItem, mode: GroupByMode): string[] {
  switch (mode) {
    case 'assignee':
      return item.assignees;
    case 'dueDate':
      return item.dueDate ? [item.dueDate] : [];
    default:
      return item.tags;
  }
}

/**
 * Groups items by the selected mode. Multi-valued modes (assignee,
 * tags) put an item into each of its groups; the "none of them" group
 * (unassigned / no due date / untagged) always comes last.
 */
export function groupItems(items: BoardItem[], mode: GroupByMode): ItemGroup[] {
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
  const result = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
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

/** How the "Assigned items" home page widget groups its entries. */
export type MyItemsGroupBy = 'board' | 'status' | 'dueDate';

export interface MyItemGroup {
  /** Stable identity: board id, column title, or due date. */
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

/**
 * Groups my-items entries for the home page widget. Board and status
 * groups are ordered alphabetically by label; due-date groups run
 * chronologically with the most urgent first and undated entries last.
 */
export function groupMyItems(
  entries: MyBoardItem[],
  mode: MyItemsGroupBy,
): MyItemGroup[] {
  const groups = new Map<string, MyItemGroup>();
  const undated: MyBoardItem[] = [];
  for (const entry of entries) {
    if (mode === 'dueDate' && !entry.item.dueDate) {
      undated.push(entry);
      continue;
    }
    let key: string;
    let label: string;
    if (mode === 'board') {
      key = entry.boardId;
      label = entry.boardName;
    } else if (mode === 'status') {
      key = entry.columnTitle;
      label = entry.columnTitle;
    } else {
      key = entry.item.dueDate!;
      label = key;
    }
    const group = groups.get(key) ?? { key, label, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  const result = [...groups.values()].sort((a, b) =>
    // due dates are `YYYY-MM-DD`, so the same comparison sorts them
    // chronologically
    mode === 'dueDate'
      ? a.key.localeCompare(b.key)
      : a.label.localeCompare(b.label),
  );
  if (undated.length > 0) {
    result.push({ key: NO_DUE_DATE, label: 'No due date', entries: undated });
  }
  return result;
}

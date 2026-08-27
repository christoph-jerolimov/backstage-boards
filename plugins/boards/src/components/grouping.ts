import { BoardColumn, BoardItem } from '@internal/plugin-boards-common';

export interface ItemSortDescriptor {
  column: 'title' | 'status' | 'dueDate' | 'createdBy' | 'updatedAt';
  direction: 'ascending' | 'descending';
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
export type GroupByMode = 'none' | 'assignee' | 'dueDate' | 'tags';

export interface ItemGroup {
  key: string;
  items: BoardItem[];
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
  if (mode === 'assignee') {
    return groupByAssignee(items);
  }
  const groups = new Map<string, BoardItem[]>();
  const rest: BoardItem[] = [];
  for (const item of items) {
    let keys: string[];
    if (mode === 'dueDate') {
      keys = item.dueDate ? [item.dueDate] : [];
    } else {
      keys = item.tags;
    }
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
    result.push({
      key: mode === 'dueDate' ? NO_DUE_DATE : UNTAGGED,
      items: rest,
    });
  }
  return result;
}

/**
 * Groups items by assignee. An item with multiple assignees appears in
 * each assignee's group; items without assignees land in the
 * {@link UNASSIGNED} group. Group order: assignees alphabetically, then
 * the unassigned group.
 */
export function groupByAssignee(
  items: BoardItem[],
): Array<{ key: string; items: BoardItem[] }> {
  const groups = new Map<string, BoardItem[]>();
  const unassigned: BoardItem[] = [];
  for (const item of items) {
    if (item.assignees.length === 0) {
      unassigned.push(item);
      continue;
    }
    for (const assignee of item.assignees) {
      const group = groups.get(assignee) ?? [];
      group.push(item);
      groups.set(assignee, group);
    }
  }
  const result = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, grouped]) => ({ key, items: grouped }));
  if (unassigned.length > 0) {
    result.push({ key: UNASSIGNED, items: unassigned });
  }
  return result;
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

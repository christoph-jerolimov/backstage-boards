import { BoardColumn, BoardItem } from '@internal/plugin-boards-common';

export interface ItemSortDescriptor {
  column: 'title' | 'status' | 'createdBy' | 'updatedAt';
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
    .map(([key, groupItems]) => ({ key, items: groupItems }));
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

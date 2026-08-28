import { BoardItem } from './types';

/**
 * Filter over a board's items. Filters combine with AND: an item matches
 * only if it satisfies the text search (title or description,
 * case-insensitive), carries ALL listed tags, and is assigned to at
 * least ONE of the listed assignees. Assignees are any-of because a
 * person is on a card or not — asking for the items two people hold
 * jointly is not the question the filter bar asks. Priorities (by id)
 * are any-of for the same reason: an item holds exactly one.
 */
export interface ItemFilter {
  text?: string;
  tags?: string[];
  assignees?: string[];
  priorities?: string[];
}

export function isEmptyFilter(filter: ItemFilter): boolean {
  return (
    !filter.text?.trim() &&
    !(filter.tags && filter.tags.length > 0) &&
    !(filter.assignees && filter.assignees.length > 0) &&
    !(filter.priorities && filter.priorities.length > 0)
  );
}

export function itemMatchesFilter(
  item: BoardItem,
  filter: ItemFilter,
): boolean {
  const text = filter.text?.trim().toLocaleLowerCase('en-US');
  if (text) {
    const haystack = `${item.title}\n${
      item.description ?? ''
    }`.toLocaleLowerCase('en-US');
    if (!haystack.includes(text)) {
      return false;
    }
  }
  for (const tag of filter.tags ?? []) {
    if (!item.tags.includes(tag)) {
      return false;
    }
  }
  const assignees = filter.assignees ?? [];
  if (
    assignees.length > 0 &&
    !assignees.some(assignee => item.assignees.includes(assignee))
  ) {
    return false;
  }
  const priorities = filter.priorities ?? [];
  if (
    priorities.length > 0 &&
    !(item.priorityId && priorities.includes(item.priorityId))
  ) {
    return false;
  }
  return true;
}

/**
 * Normalizes tags for storage: strips every `#`, trims whitespace,
 * drops empty results, and removes duplicates preserving order.
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const cleaned = tag.replaceAll('#', '').trim();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

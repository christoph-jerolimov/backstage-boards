import { BoardItem } from './types';

/**
 * Filter over a board's items. Filters combine with AND: an item matches
 * only if it satisfies the text search (title or description,
 * case-insensitive), carries ALL listed tags, and has ALL listed label
 * key=value pairs.
 */
export interface ItemFilter {
  text?: string;
  tags?: string[];
  labels?: Record<string, string>;
}

export function isEmptyFilter(filter: ItemFilter): boolean {
  return (
    !filter.text?.trim() &&
    !(filter.tags && filter.tags.length > 0) &&
    !(filter.labels && Object.keys(filter.labels).length > 0)
  );
}

export function itemMatchesFilter(item: BoardItem, filter: ItemFilter): boolean {
  const text = filter.text?.trim().toLocaleLowerCase('en-US');
  if (text) {
    const haystack = `${item.title}\n${item.description ?? ''}`.toLocaleLowerCase(
      'en-US',
    );
    if (!haystack.includes(text)) {
      return false;
    }
  }
  for (const tag of filter.tags ?? []) {
    if (!item.tags.includes(tag)) {
      return false;
    }
  }
  for (const [key, value] of Object.entries(filter.labels ?? {})) {
    if (item.labels[key] !== value) {
      return false;
    }
  }
  return true;
}

import { useMemo, useState } from 'react';
import {
  Button,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  SearchField,
  Text,
} from '@backstage/ui';
import {
  BoardItem,
  BoardPriority,
  ItemFilter,
  isEmptyFilter,
  isTextRef,
  itemMatchesFilter,
  refDisplayName,
} from '@internal/plugin-boards-common';
import { useProfiles } from './useProfiles';
import { RefLabel } from './common';
import { ColorDot } from './StatusBadge';

/** One entry of the assignee filter menu: the ref and how it reads. */
export interface AssigneeOption {
  ref: string;
  label: string;
}

/** One entry of the priority filter menu: the definition and its use. */
export interface PriorityOption {
  priority: BoardPriority;
  /** How many of the listed items hold this priority. */
  count: number;
}

export interface ItemFilterHandle {
  filter: ItemFilter;
  /** The selected tags, as the filter menu needs them. */
  tags: string[];
  /** The selected assignee refs, as the filter menu needs them. */
  assignees: string[];
  /** The selected priority ids, as the filter menu needs them. */
  priorities: string[];
  /** The items left after the filter, in their original order. */
  filteredItems: BoardItem[];
  /** Every tag used on the board, offered as filter options. */
  allTags: string[];
  /** Every assignee used on the board, labelled and sorted by label. */
  assigneeOptions: AssigneeOption[];
  /** The priorities in use on the board, highest (order 1) first. */
  priorityOptions: PriorityOption[];
  totalCount: number;
  active: boolean;
  setText: (text: string) => void;
  toggleTag: (tag: string) => void;
  toggleAssignee: (ref: string) => void;
  togglePriority: (priorityId: string) => void;
  clear: () => void;
}

const toggled = (current: string[], entry: string) =>
  current.includes(entry)
    ? current.filter(other => other !== entry)
    : [...current, entry];

/**
 * Owns the board's text, tag and assignee filter and applies it to the
 * items. The assignee options are labelled through the catalog, so they
 * read like the names on the cards and sort the same way.
 */
export function useItemFilter(
  items: BoardItem[],
  boardPriorities: BoardPriority[] = [],
): ItemFilterHandle {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);

  const allAssignees = useMemo(
    () => [...new Set(items.flatMap(item => item.assignees))],
    [items],
  );
  const profiles = useProfiles(
    useMemo(() => allAssignees.filter(ref => !isTextRef(ref)), [allAssignees]),
  );
  const assigneeOptions = useMemo(
    () =>
      allAssignees
        .map(ref => ({
          ref,
          label: profiles.get(ref)?.displayName ?? refDisplayName(ref),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [allAssignees, profiles],
  );

  const priorityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.priorityId) {
        counts.set(item.priorityId, (counts.get(item.priorityId) ?? 0) + 1);
      }
    }
    return [...boardPriorities]
      .sort((a, b) => a.order - b.order)
      .flatMap(priority => {
        const count = counts.get(priority.id) ?? 0;
        return count > 0 ? [{ priority, count }] : [];
      });
  }, [items, boardPriorities]);

  return useMemo(() => {
    const filter: ItemFilter = { text, tags, assignees, priorities };
    return {
      filter,
      tags,
      assignees,
      priorities,
      filteredItems: items.filter(item => itemMatchesFilter(item, filter)),
      allTags: [...new Set(items.flatMap(item => item.tags))].sort(),
      assigneeOptions,
      priorityOptions,
      totalCount: items.length,
      active: !isEmptyFilter(filter),
      setText,
      toggleTag: (tag: string) => setTags(current => toggled(current, tag)),
      toggleAssignee: (ref: string) =>
        setAssignees(current => toggled(current, ref)),
      togglePriority: (priorityId: string) =>
        setPriorities(current => toggled(current, priorityId)),
      clear: () => {
        setText('');
        setTags([]);
        setAssignees([]);
        setPriorities([]);
      },
    };
  }, [items, text, tags, assignees, priorities, assigneeOptions, priorityOptions]);
}

/**
 * Search field, tag and assignee filter menus, and the match count of
 * {@link useItemFilter}. Shared by the board page and the my-items
 * listing.
 *
 * `minAssigneeOptions` is how many assignees must be in play before the
 * assignee menu is worth showing. A board defaults to one — the menu
 * then separates that person's items from the unassigned ones. The
 * my-items listing passes two, because every item there is already the
 * viewer's, so a single option would match every row.
 */
export function ItemFilterBar(props: {
  filter: ItemFilterHandle;
  minAssigneeOptions?: number;
}) {
  const { filter, minAssigneeOptions = 1 } = props;
  return (
    <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
      <div style={{ width: 240, flexShrink: 0 }}>
        <SearchField
          aria-label="Search items"
          placeholder="Search items…"
          value={filter.filter.text ?? ''}
          onChange={filter.setText}
          size="small"
        />
      </div>
      {filter.allTags.length > 0 && (
        <MenuTrigger>
          <Button variant="tertiary" size="small">
            Tags{filter.tags.length > 0 ? ` (${filter.tags.length})` : ''}
          </Button>
          <Menu aria-label="Filter by tags">
            {filter.allTags.map(tag => (
              <MenuItem key={tag} onAction={() => filter.toggleTag(tag)}>
                {filter.tags.includes(tag) ? `✓ ${tag}` : tag}
              </MenuItem>
            ))}
          </Menu>
        </MenuTrigger>
      )}
      {filter.priorityOptions.length > 0 && (
        <MenuTrigger>
          <Button variant="tertiary" size="small">
            Priority
            {filter.priorities.length > 0
              ? ` (${filter.priorities.length})`
              : ''}
          </Button>
          <Menu aria-label="Filter by priority">
            {filter.priorityOptions.map(option => (
              <MenuItem
                key={option.priority.id}
                onAction={() => filter.togglePriority(option.priority.id)}
              >
                <Flex align="center" gap="2">
                  <ColorDot color={option.priority.color} size={8} />
                  <span>
                    {filter.priorities.includes(option.priority.id)
                      ? `✓ ${option.priority.name}`
                      : option.priority.name}{' '}
                    ({option.count})
                  </span>
                </Flex>
              </MenuItem>
            ))}
          </Menu>
        </MenuTrigger>
      )}
      {filter.assigneeOptions.length >= minAssigneeOptions && (
        <MenuTrigger>
          <Button variant="tertiary" size="small">
            Assignees
            {filter.assignees.length > 0 ? ` (${filter.assignees.length})` : ''}
          </Button>
          <Menu aria-label="Filter by assignees">
            {filter.assigneeOptions.map(option => (
              <MenuItem
                key={option.ref}
                onAction={() => filter.toggleAssignee(option.ref)}
              >
                <RefLabel entityRef={option.ref}>
                  {filter.assignees.includes(option.ref)
                    ? `✓ ${option.label}`
                    : option.label}
                </RefLabel>
              </MenuItem>
            ))}
          </Menu>
        </MenuTrigger>
      )}
      {filter.active && (
        <>
          <Text variant="body-small" color="secondary" style={{ flexGrow: 1 }}>
            {filter.filteredItems.length} of {filter.totalCount} items
          </Text>
          <Button variant="tertiary" size="small" onPress={filter.clear}>
            Clear filters
          </Button>
        </>
      )}
    </Flex>
  );
}

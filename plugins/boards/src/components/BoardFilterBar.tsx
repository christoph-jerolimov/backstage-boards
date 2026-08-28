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
  ItemFilter,
  isEmptyFilter,
  itemMatchesFilter,
} from '@internal/plugin-boards-common';

export interface ItemFilterHandle {
  filter: ItemFilter;
  /** The selected tags, as the filter menu needs them. */
  tags: string[];
  /** The items left after the filter, in their original order. */
  filteredItems: BoardItem[];
  /** Every tag used on the board, offered as filter options. */
  allTags: string[];
  totalCount: number;
  active: boolean;
  setText: (text: string) => void;
  toggleTag: (tag: string) => void;
  clear: () => void;
}

/** Owns the board's text and tag filter and applies it to the items. */
export function useItemFilter(items: BoardItem[]): ItemFilterHandle {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  return useMemo(() => {
    const filter: ItemFilter = { text, tags };
    return {
      filter,
      tags,
      filteredItems: items.filter(item => itemMatchesFilter(item, filter)),
      allTags: [...new Set(items.flatMap(item => item.tags))].sort(),
      totalCount: items.length,
      active: !isEmptyFilter(filter),
      setText,
      toggleTag: (tag: string) =>
        setTags(current =>
          current.includes(tag)
            ? current.filter(entry => entry !== tag)
            : [...current, tag],
        ),
      clear: () => {
        setText('');
        setTags([]);
      },
    };
  }, [items, text, tags]);
}

/** Search field, tag filter menu and the match count of {@link useItemFilter}. */
export function BoardFilterBar(props: { filter: ItemFilterHandle }) {
  const { filter } = props;
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

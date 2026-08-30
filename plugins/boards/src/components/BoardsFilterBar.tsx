import { useEffect, useMemo, useState } from 'react';
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
  BoardFilterOptions,
  BoardListFilter,
  isTextRef,
  refDisplayName,
} from '@internal/plugin-boards-common';
import { useBoardFilterOptionsQuery } from '../queries';
import { useProfiles } from './useProfiles';
import { RefLabel } from '@internal/plugin-boards-react';

/** How long typing settles before it becomes a request. */
const SEARCH_DEBOUNCE_MS = 250;

export interface BoardFilterHandle {
  /** What the listing request carries; the search is the debounced one. */
  filter: BoardListFilter;
  /** What the user has typed, which the field shows before the debounce. */
  pending: string;
  active: boolean;
  /** The dropdown options, and how many boards the user can read at all. */
  options?: BoardFilterOptions;
  setSearch: (search: string) => void;
  setEntityRef: (entityRef?: string) => void;
  setCreatedBy: (createdBy?: string) => void;
  clear: () => void;
}

/**
 * Owns the board list's filter. Unlike the item filter next door this one
 * filters nothing itself: with pagination the page only ever holds one
 * page of boards, so narrowing has to happen in the request. What it owns
 * is the pending state and the debounce.
 */
export function useBoardFilter(): BoardFilterHandle {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [entityRef, setEntityRef] = useState<string | undefined>();
  const [createdBy, setCreatedBy] = useState<string | undefined>();
  const { data: options } = useBoardFilterOptionsQuery();

  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  return useMemo(
    () => ({
      // the pending text rides along so the field stays responsive while
      // only the request lags behind it
      filter: { search: debounced, entityRef, createdBy },
      pending: search,
      active: !!(search.trim() || entityRef || createdBy),
      options,
      setSearch,
      setEntityRef,
      setCreatedBy,
      clear: () => {
        setSearch('');
        setDebounced('');
        setEntityRef(undefined);
        setCreatedBy(undefined);
      },
    }),
    [search, debounced, entityRef, createdBy, options],
  );
}

/** One dropdown over a set of refs, with an entry that selects none. */
function RefFilterMenu(props: {
  label: string;
  /** The entry that clears this filter, e.g. "All entities". */
  anyLabel: string;
  refs: string[];
  selected?: string;
  onSelect: (ref?: string) => void;
}) {
  const { label, anyLabel, refs, selected, onSelect } = props;
  const profiles = useProfiles(
    useMemo(() => refs.filter(ref => !isTextRef(ref)), [refs]),
  );
  const options = useMemo(
    () =>
      refs
        .map(ref => ({
          ref,
          label: profiles.get(ref)?.displayName ?? refDisplayName(ref),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [refs, profiles],
  );
  if (refs.length === 0) {
    return null;
  }
  const selectedLabel = options.find(option => option.ref === selected)?.label;
  return (
    <MenuTrigger>
      <Button variant="tertiary" size="small">
        {selectedLabel ? `${label}: ${selectedLabel}` : label}
      </Button>
      <Menu aria-label={`Filter by ${label.toLocaleLowerCase('en-US')}`}>
        <MenuItem onAction={() => onSelect(undefined)}>
          {selected ? anyLabel : `✓ ${anyLabel}`}
        </MenuItem>
        {options.map(option => (
          <MenuItem key={option.ref} onAction={() => onSelect(option.ref)}>
            <RefLabel entityRef={option.ref}>
              {selected === option.ref ? `✓ ${option.label}` : option.label}
            </RefLabel>
          </MenuItem>
        ))}
      </Menu>
    </MenuTrigger>
  );
}

/**
 * Search field and the entity and creator dropdowns of the board list,
 * in the shape {@link ItemFilterBar} established. The dropdown options
 * come from the boards the user can read and from nowhere else, so the
 * bar never names an entity, a user, or a board they cannot see.
 */
export function BoardsFilterBar(props: {
  filter: BoardFilterHandle;
  /** Boards matching the filter, for the count beside "Clear filters". */
  matchCount: number;
  /**
   * The unfiltered total the match count reads against — the tab's whole
   * set, e.g. the favorites count on the favorites tab. Defaults to all
   * boards the user can read.
   */
  total?: number;
}) {
  const { filter, matchCount, total } = props;
  return (
    <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
      <div style={{ width: 240, flexShrink: 0 }}>
        <SearchField
          aria-label="Search boards"
          placeholder="Search boards…"
          value={filter.pending}
          onChange={filter.setSearch}
          size="small"
        />
      </div>
      <RefFilterMenu
        label="Entity"
        anyLabel="All entities"
        refs={filter.options?.entityRefs ?? []}
        selected={filter.filter.entityRef}
        onSelect={filter.setEntityRef}
      />
      <RefFilterMenu
        label="Created by"
        anyLabel="Anyone"
        refs={filter.options?.creators ?? []}
        selected={filter.filter.createdBy}
        onSelect={filter.setCreatedBy}
      />
      {filter.active && (
        <>
          <Text variant="body-small" color="secondary" style={{ flexGrow: 1 }}>
            {matchCount} of {total ?? filter.options?.total ?? 0} boards
          </Text>
          <Button variant="tertiary" size="small" onPress={filter.clear}>
            Clear filters
          </Button>
        </>
      )}
    </Flex>
  );
}

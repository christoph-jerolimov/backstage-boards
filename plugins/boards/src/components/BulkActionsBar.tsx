import { Button, Flex, Menu, MenuItem, MenuTrigger, Text } from '@backstage/ui';
import { useApi, identityApiRef } from '@backstage/frontend-plugin-api';
import {
  BoardItem,
  BoardWithContext,
  fridayISO,
  isTextRef,
  refDisplayName,
  todayISO,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queries';
import type { BulkActions } from './useBoardActions';
import { useProfiles } from './useProfiles';
import { RefLabel } from './common';

/** How much of the selection matches a value the menus offer. */
type MatchState = 'all' | 'some' | 'none';

/** The `✓ `/`– ` label prefix for a fully/partially matching entry. */
const mark = (state: MatchState) =>
  state === 'all' ? '✓ ' : state === 'some' ? '– ' : '';

/**
 * The toolbar the table view shows while items are selected: status,
 * priority, assignee and due-date dropdowns plus Archive, all applied
 * to every selected item through the bulk fan-out actions.
 */
export function BulkActionsBar(props: {
  board: BoardWithContext;
  selectedItems: BoardItem[];
  /** Assignees seen on the board's items, offered for quick assign. */
  assigneePool: string[];
  bulk: BulkActions;
  onClear: () => void;
}) {
  const { board, selectedItems, assigneePool, bulk, onClear } = props;
  const identityApi = useApi(identityApiRef);
  const { data: identity } = useQuery({
    queryKey: queryKeys.identity,
    staleTime: Infinity,
    queryFn: () => identityApi.getBackstageIdentity(),
  });
  const meRef = identity?.userEntityRef;
  const pool = [...new Set(assigneePool)].filter(ref => ref !== meRef);
  const profiles = useProfiles(pool.filter(ref => !isTextRef(ref)));
  const nameOf = (ref: string) =>
    profiles.get(ref)?.displayName ?? refDisplayName(ref);
  const others = [...pool].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const stateOf = (matches: (item: BoardItem) => boolean): MatchState => {
    const count = selectedItems.filter(matches).length;
    if (count === selectedItems.length) {
      return 'all';
    }
    return count > 0 ? 'some' : 'none';
  };

  const setStatus = (columnId: string) => {
    const itemIds = selectedItems
      .filter(item => item.columnId !== columnId)
      .map(item => item.id);
    if (itemIds.length > 0) {
      bulk.moveItems(itemIds, columnId);
    }
  };

  const setPriority = (priorityId: string | null) => {
    const entries = selectedItems
      .filter(item => (item.priorityId ?? null) !== priorityId)
      .map(item => ({ itemId: item.id, update: { priorityId } }));
    if (entries.length > 0) {
      bulk.updateItems(entries);
    }
  };

  // adds the assignee to the items missing them; removes them everywhere
  // once the whole selection has them (same toggle as the item menu)
  const toggleAssignee = (ref: string) => {
    const allHave = selectedItems.every(item => item.assignees.includes(ref));
    const entries = allHave
      ? selectedItems.map(item => ({
          itemId: item.id,
          update: { assignees: item.assignees.filter(entry => entry !== ref) },
        }))
      : selectedItems
          .filter(item => !item.assignees.includes(ref))
          .map(item => ({
            itemId: item.id,
            update: { assignees: [...item.assignees, ref] },
          }));
    if (entries.length > 0) {
      bulk.updateItems(entries);
    }
  };

  const clearAssignees = () => {
    const entries = selectedItems
      .filter(item => item.assignees.length > 0)
      .map(item => ({ itemId: item.id, update: { assignees: [] } }));
    if (entries.length > 0) {
      bulk.updateItems(entries);
    }
  };

  const setDueDate = (dueDate: string | null) => {
    const entries = selectedItems
      .filter(item => (item.dueDate ?? null) !== dueDate)
      .map(item => ({ itemId: item.id, update: { dueDate } }));
    if (entries.length > 0) {
      bulk.updateItems(entries);
    }
  };

  const assigneeState = (ref: string) =>
    stateOf(item => item.assignees.includes(ref));

  return (
    <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
      <Text variant="body-small" weight="bold">
        {selectedItems.length} selected
      </Text>
      <MenuTrigger>
        <Button variant="tertiary" size="small">
          Status
        </Button>
        <Menu aria-label="Change status">
          {[...board.columns]
            .sort((a, b) => a.position - b.position)
            .map(column => (
              <MenuItem key={column.id} onAction={() => setStatus(column.id)}>
                {mark(stateOf(item => item.columnId === column.id))}
                {column.title}
              </MenuItem>
            ))}
        </Menu>
      </MenuTrigger>
      {board.priorities.length > 0 && (
        <MenuTrigger>
          <Button variant="tertiary" size="small">
            Priority
          </Button>
          <Menu aria-label="Change priority">
            {[...board.priorities]
              .sort((a, b) => a.order - b.order)
              .map(priority => (
                <MenuItem
                  key={priority.id}
                  onAction={() => setPriority(priority.id)}
                >
                  {mark(stateOf(item => item.priorityId === priority.id))}
                  {priority.name}
                </MenuItem>
              ))}
            <MenuItem onAction={() => setPriority(null)}>
              {mark(stateOf(item => !item.priorityId))}No priority
            </MenuItem>
          </Menu>
        </MenuTrigger>
      )}
      <MenuTrigger>
        <Button variant="tertiary" size="small">
          Assignee
        </Button>
        <Menu aria-label="Change assignee">
          {meRef && (
            <MenuItem onAction={() => toggleAssignee(meRef)}>
              {/* "Me" names a ref too: the tooltip says which account */}
              <RefLabel entityRef={meRef}>
                {mark(assigneeState(meRef))}Me
              </RefLabel>
            </MenuItem>
          )}
          {others.map(ref => (
            <MenuItem key={ref} onAction={() => toggleAssignee(ref)}>
              <RefLabel entityRef={ref}>
                {mark(assigneeState(ref))}
                {nameOf(ref)}
              </RefLabel>
            </MenuItem>
          ))}
          <MenuItem onAction={clearAssignees}>
            {mark(stateOf(item => item.assignees.length === 0))}No assignee
          </MenuItem>
        </Menu>
      </MenuTrigger>
      <MenuTrigger>
        <Button variant="tertiary" size="small">
          Due date
        </Button>
        <Menu aria-label="Change due date">
          <MenuItem onAction={() => setDueDate(todayISO())}>Today</MenuItem>
          <MenuItem onAction={() => setDueDate(tomorrowISO())}>
            Tomorrow
          </MenuItem>
          <MenuItem onAction={() => setDueDate(fridayISO())}>
            This week (Fri)
          </MenuItem>
          <MenuItem color="danger" onAction={() => setDueDate(null)}>
            Remove due date
          </MenuItem>
        </Menu>
      </MenuTrigger>
      <Button
        variant="secondary"
        destructive
        size="small"
        onPress={() => bulk.archiveItems(selectedItems.map(item => item.id))}
      >
        Archive
      </Button>
      <Button variant="tertiary" size="small" onPress={onClear}>
        Clear selection
      </Button>
    </Flex>
  );
}

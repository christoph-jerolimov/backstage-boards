import type { ReactNode } from 'react';
import { Menu, MenuItem, SubmenuTrigger } from '@backstage/ui';
import { useApi, identityApiRef } from '@backstage/frontend-plugin-api';
import {
  BoardColumn,
  BoardItem,
  fridayISO,
  isTextRef,
  refDisplayName,
  todayISO,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queries';
import { useProfiles } from './useProfiles';
import { RefLabel } from './common';

/**
 * The item mutations the item menu needs. Kept separate from the board
 * view's `BoardActions` (which extends it) so surfaces that can only act
 * on items — the my-items table — supply exactly what they can honor.
 */
export interface ItemActions {
  openItem: (itemId: string) => void;
  moveItem: (
    itemId: string,
    target: { columnId: string; position?: number },
  ) => Promise<void>;
  setItemDueDate: (itemId: string, dueDate: string | null) => Promise<void>;
  setAssignees: (itemId: string, assignees: string[]) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

/**
 * The shared item actions menu: used by the card's three-dot button,
 * the table row's three-dot button, and the right-click context menu.
 */
export function ItemMenu(props: {
  item: BoardItem;
  columns: BoardColumn[];
  readonly: boolean;
  actions: ItemActions;
  /** Assignees seen on the board's items, offered for quick assign. */
  assigneePool: string[];
  /** Extra entries for one surface only, rendered after "Open details". */
  extraItems?: ReactNode;
}) {
  const { item, columns, readonly, actions, assigneePool, extraItems } = props;
  const identityApi = useApi(identityApiRef);
  const { data: identity } = useQuery({
    queryKey: queryKeys.identity,
    staleTime: Infinity,
    queryFn: () => identityApi.getBackstageIdentity(),
  });
  const meRef = identity?.userEntityRef;
  const pool = [...new Set(assigneePool)].filter(ref => ref !== meRef);
  // the same sorted ref list the cards already resolve, so this is served
  // from cache; until it is, entries read by their ref name
  const profiles = useProfiles(pool.filter(ref => !isTextRef(ref)));
  const nameOf = (ref: string) =>
    profiles.get(ref)?.displayName ?? refDisplayName(ref);
  const others = [...pool].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const toggle = (ref: string) => {
    const next = item.assignees.includes(ref)
      ? item.assignees.filter(entry => entry !== ref)
      : [...item.assignees, ref];
    actions.setAssignees(item.id, next);
  };
  const mark = (ref: string, label: string) =>
    item.assignees.includes(ref) ? `✓ ${label}` : label;
  return (
    <Menu placement="right top">
      <MenuItem onAction={() => actions.openItem(item.id)}>
        Open details
      </MenuItem>
      {extraItems}
      {!readonly && (
        <SubmenuTrigger>
          <MenuItem>Move to column</MenuItem>
          <Menu>
            {columns
              .filter(column => column.id !== item.columnId)
              .map(column => (
                <MenuItem
                  key={column.id}
                  onAction={() =>
                    actions.moveItem(item.id, { columnId: column.id })
                  }
                >
                  {column.title}
                </MenuItem>
              ))}
          </Menu>
        </SubmenuTrigger>
      )}
      {!readonly && (
        <SubmenuTrigger>
          <MenuItem>Due date</MenuItem>
          <Menu>
            <MenuItem
              onAction={() => actions.setItemDueDate(item.id, todayISO())}
            >
              Today
            </MenuItem>
            <MenuItem
              onAction={() => actions.setItemDueDate(item.id, tomorrowISO())}
            >
              Tomorrow
            </MenuItem>
            <MenuItem
              onAction={() => actions.setItemDueDate(item.id, fridayISO())}
            >
              This week (Fri)
            </MenuItem>
            {item.dueDate && (
              <MenuItem
                color="danger"
                onAction={() => actions.setItemDueDate(item.id, null)}
              >
                Remove due date
              </MenuItem>
            )}
          </Menu>
        </SubmenuTrigger>
      )}
      {!readonly && (
        <SubmenuTrigger>
          <MenuItem>Assignee</MenuItem>
          <Menu>
            {meRef && (
              <MenuItem onAction={() => toggle(meRef)}>
                {/* "Me" names a ref too: the tooltip says which account */}
                <RefLabel entityRef={meRef}>{mark(meRef, 'Me')}</RefLabel>
              </MenuItem>
            )}
            {others.map(ref => (
              <MenuItem key={ref} onAction={() => toggle(ref)}>
                <RefLabel entityRef={ref}>{mark(ref, nameOf(ref))}</RefLabel>
              </MenuItem>
            ))}
          </Menu>
        </SubmenuTrigger>
      )}
      {!readonly && (
        <MenuItem color="danger" onAction={() => actions.deleteItem(item.id)}>
          Delete item
        </MenuItem>
      )}
    </Menu>
  );
}

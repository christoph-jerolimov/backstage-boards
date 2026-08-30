import type { ReactNode } from 'react';
import { Menu, MenuItem, SubmenuTrigger } from '@backstage/ui';
import { useApi, identityApiRef } from '@backstage/frontend-plugin-api';
import {
  BoardColumn,
  BoardItem,
  BoardPriority,
  fridayISO,
  isTextRef,
  refDisplayName,
  todayISO,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queries';
import { useProfiles } from './useProfiles';
import type { ItemSubmenuKind } from './RowMenu';
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
  setItemPriority: (itemId: string, priorityId: string | null) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

/**
 * The shared item actions menu: used by the card's three-dot button,
 * the table row's three-dot button, and the right-click context menu.
 */
export function ItemMenu(props: {
  item: BoardItem;
  columns: BoardColumn[];
  /** The item's board's priorities; empty hides the priority submenu. */
  priorities: BoardPriority[];
  readonly: boolean;
  actions: ItemActions;
  /** Assignees seen on the board's items, offered for quick assign. */
  assigneePool: string[];
  /** Extra entries for one surface only, rendered after "Open details". */
  extraItems?: ReactNode;
  /** Columns at their hard WIP limit: their move entries disable. */
  fullColumnIds?: Set<string>;
  /** The drawer already shows the details, so it drops the entry. */
  showOpenDetails?: boolean;
  /**
   * Render only this submenu's entries as a flat menu — the keyboard
   * shortcuts (s/c/m, a, d, p) open the pickers directly.
   */
  submenu?: ItemSubmenuKind;
}) {
  const {
    item,
    columns,
    priorities,
    readonly,
    actions,
    assigneePool,
    extraItems,
    showOpenDetails = true,
    submenu,
  } = props;
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

  // the submenus' entries, shared between the nested item menu and the
  // flat pickers the keyboard shortcuts open directly
  const moveEntries = columns
    .filter(column => column.id !== item.columnId)
    .map(column => (
      <MenuItem
        key={column.id}
        isDisabled={props.fullColumnIds?.has(column.id)}
        onAction={() => actions.moveItem(item.id, { columnId: column.id })}
      >
        {column.title}
      </MenuItem>
    ));
  const dueEntries = [
    <MenuItem
      key="today"
      onAction={() => actions.setItemDueDate(item.id, todayISO())}
    >
      Today
    </MenuItem>,
    <MenuItem
      key="tomorrow"
      onAction={() => actions.setItemDueDate(item.id, tomorrowISO())}
    >
      Tomorrow
    </MenuItem>,
    <MenuItem
      key="friday"
      onAction={() => actions.setItemDueDate(item.id, fridayISO())}
    >
      This week (Fri)
    </MenuItem>,
    ...(item.dueDate
      ? [
          <MenuItem
            key="remove"
            color="danger"
            onAction={() => actions.setItemDueDate(item.id, null)}
          >
            Remove due date
          </MenuItem>,
        ]
      : []),
  ];
  const priorityEntries = [
    ...[...priorities]
      .sort((a, b) => a.order - b.order)
      .map(priority => (
        <MenuItem
          key={priority.id}
          onAction={() => actions.setItemPriority(item.id, priority.id)}
        >
          {item.priorityId === priority.id
            ? `✓ ${priority.name}`
            : priority.name}
        </MenuItem>
      )),
    ...(item.priorityId
      ? [
          <MenuItem
            key="remove"
            color="danger"
            onAction={() => actions.setItemPriority(item.id, null)}
          >
            Remove priority
          </MenuItem>,
        ]
      : []),
  ];
  const assigneeEntries = [
    ...(meRef
      ? [
          <MenuItem key={meRef} onAction={() => toggle(meRef)}>
            {/* "Me" names a ref too: the tooltip says which account */}
            <RefLabel entityRef={meRef}>{mark(meRef, 'Me')}</RefLabel>
          </MenuItem>,
        ]
      : []),
    ...others.map(ref => (
      <MenuItem key={ref} onAction={() => toggle(ref)}>
        <RefLabel entityRef={ref}>{mark(ref, nameOf(ref))}</RefLabel>
      </MenuItem>
    )),
  ];

  if (submenu) {
    // the shortcut guards already keep read-only items out; render
    // nothing rather than an empty picker if one slips through
    if (readonly || (submenu === 'priority' && priorities.length === 0)) {
      return null;
    }
    const flat = {
      move: { label: 'Move to column', entries: moveEntries },
      due: { label: 'Due date', entries: dueEntries },
      priority: { label: 'Priority', entries: priorityEntries },
      assignee: { label: 'Assignee', entries: assigneeEntries },
    }[submenu];
    return (
      <Menu placement="right top" aria-label={flat.label}>
        {flat.entries}
      </Menu>
    );
  }

  return (
    <Menu placement="right top">
      {showOpenDetails && (
        <MenuItem onAction={() => actions.openItem(item.id)}>
          Open details
        </MenuItem>
      )}
      {extraItems}
      {!readonly && (
        <SubmenuTrigger>
          <MenuItem>Move to column</MenuItem>
          <Menu>{moveEntries}</Menu>
        </SubmenuTrigger>
      )}
      {!readonly && (
        <SubmenuTrigger>
          <MenuItem>Due date</MenuItem>
          <Menu>{dueEntries}</Menu>
        </SubmenuTrigger>
      )}
      {!readonly && priorities.length > 0 && (
        <SubmenuTrigger>
          <MenuItem>Priority</MenuItem>
          <Menu>{priorityEntries}</Menu>
        </SubmenuTrigger>
      )}
      {!readonly && (
        <SubmenuTrigger>
          <MenuItem>Assignee</MenuItem>
          <Menu>{assigneeEntries}</Menu>
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

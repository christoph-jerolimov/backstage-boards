import {
  ButtonIcon,
  Menu,
  MenuItem,
  MenuTrigger,
  SubmenuTrigger,
} from '@backstage/ui';
import { useApi, identityApiRef } from '@backstage/frontend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import {
  BoardColumn,
  BoardItem,
  fridayISO,
  isTextRef,
  textRefDisplay,
  todayISO,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import { useAsyncData } from './common';
import type { BoardActions } from './KanbanView';

function assigneeLabel(ref: string): string {
  if (isTextRef(ref)) {
    return textRefDisplay(ref) ?? ref;
  }
  try {
    return parseEntityRef(ref).name;
  } catch {
    return ref;
  }
}

/**
 * The shared item actions menu: used by the card's three-dot button,
 * the table row's three-dot button, and the right-click context menu.
 */
export function ItemMenu(props: {
  item: BoardItem;
  columns: BoardColumn[];
  readonly: boolean;
  actions: BoardActions;
  /** Assignees seen on the board's items, offered for quick assign. */
  assigneePool: string[];
}) {
  const { item, columns, readonly, actions, assigneePool } = props;
  const identityApi = useApi(identityApiRef);
  const { data: identity } = useAsyncData(
    () => identityApi.getBackstageIdentity(),
    [identityApi],
  );
  const meRef = identity?.userEntityRef;
  const others = [...new Set(assigneePool)]
    .filter(ref => ref !== meRef)
    .sort((a, b) => assigneeLabel(a).localeCompare(assigneeLabel(b)));
  const toggle = (ref: string) => {
    const next = item.assignees.includes(ref)
      ? item.assignees.filter(entry => entry !== ref)
      : [...item.assignees, ref];
    actions.setAssignees(item.id, next);
  };
  const mark = (ref: string, label: string) =>
    item.assignees.includes(ref) ? `✓ ${label}` : label;
  return (
    <Menu>
      <MenuItem onAction={() => actions.openItem(item.id)}>
        Open details
      </MenuItem>
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
                {mark(meRef, 'Me')}
              </MenuItem>
            )}
            {others.map(ref => (
              <MenuItem key={ref} onAction={() => toggle(ref)}>
                {mark(ref, assigneeLabel(ref))}
              </MenuItem>
            ))}
          </Menu>
        </SubmenuTrigger>
      )}
      {!readonly && (
        <MenuItem
          color="danger"
          onAction={() => actions.deleteItem(item.id)}
        >
          Delete item
        </MenuItem>
      )}
    </Menu>
  );
}

export interface ContextMenuState {
  item: BoardItem;
  x: number;
  y: number;
}

/**
 * The shared menu opened at the pointer position: a controlled
 * MenuTrigger anchored to an invisible button placed where the user
 * right-clicked.
 */
export function ItemContextMenu(props: {
  state: ContextMenuState | undefined;
  onClose: () => void;
  columns: BoardColumn[];
  readonly: boolean;
  actions: BoardActions;
  assigneePool: string[];
}) {
  const { state, onClose, columns, readonly, actions, assigneePool } = props;
  if (!state) {
    return null;
  }
  return (
    <MenuTrigger isOpen onOpenChange={open => !open && onClose()}>
      <ButtonIcon
        aria-label={`Context menu for ${state.item.title}`}
        icon={<span />}
        style={{
          position: 'fixed',
          left: state.x,
          top: state.y,
          width: 1,
          height: 1,
          minWidth: 0,
          padding: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <ItemMenu
        item={state.item}
        columns={columns}
        readonly={readonly}
        actions={actions}
        assigneePool={assigneePool}
      />
    </MenuTrigger>
  );
}

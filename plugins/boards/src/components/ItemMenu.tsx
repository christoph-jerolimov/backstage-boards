import {
  ButtonIcon,
  Menu,
  MenuItem,
  MenuTrigger,
  SubmenuTrigger,
} from '@backstage/ui';
import {
  BoardColumn,
  BoardItem,
  fridayISO,
  todayISO,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import type { BoardActions } from './KanbanView';

/**
 * The shared item actions menu: used by the card's three-dot button,
 * the table row's three-dot button, and the right-click context menu.
 */
export function ItemMenu(props: {
  item: BoardItem;
  columns: BoardColumn[];
  readonly: boolean;
  actions: BoardActions;
}) {
  const { item, columns, readonly, actions } = props;
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
}) {
  const { state, onClose, columns, readonly, actions } = props;
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
      />
    </MenuTrigger>
  );
}

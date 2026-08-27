import { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-aria';
import {
  Button,
  ButtonIcon,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Select,
  SubmenuTrigger,
  Text,
  TextField,
} from '@backstage/ui';
import {
  BoardColumn,
  BoardItem,
  BoardWithContext,
  COLUMN_COLORS,
  ColumnColor,
} from '@internal/plugin-boards-common';
import { GroupByMode, groupItems, positionBefore } from './grouping';
import { GroupLabel } from './GroupLabel';
import { ItemContextMenu, ItemMenu } from './ItemMenu';
import { useRowContextMenu } from './RowMenu';
import { InlineEdit } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { ColumnDot } from './StatusBadge';

const DRAG_TYPE = 'application/x-boards-item';

export interface BoardActions {
  moveItem: (
    itemId: string,
    target: { columnId: string; position?: number },
  ) => Promise<void>;
  createItem: (columnId: string, title: string) => Promise<void>;
  renameColumn: (columnId: string, title: string) => Promise<void>;
  reorderColumn: (columnId: string, position: number) => Promise<void>;
  addColumn: (title: string) => Promise<void>;
  setColumnColor: (columnId: string, color: string | null) => Promise<void>;
  deleteColumn: (columnId: string, moveItemsTo?: string) => Promise<void>;
  openItem: (itemId: string) => void;
  renameItem: (itemId: string, title: string) => Promise<void>;
  setItemDueDate: (itemId: string, dueDate: string | null) => Promise<void>;
  setAssignees: (itemId: string, assignees: string[]) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

function ItemCard(props: {
  item: BoardItem;
  columns: BoardColumn[];
  canWrite: boolean;
  actions: BoardActions;
  assigneePool: string[];
  onDropBefore: (droppedItemId: string) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}) {
  const { item, columns, canWrite, actions } = props;
  const readonly = !canWrite || !!item.externalManager;
  const cardRef = useRef<HTMLDivElement>(null);

  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ [DRAG_TYPE]: item.id }],
  });

  const { dropProps, isDropTarget } = useDrop({
    ref: cardRef,
    onDrop: async event => {
      const dragged = event.items.find(
        entry => entry.kind === 'text' && entry.types.has(DRAG_TYPE),
      );
      if (dragged && dragged.kind === 'text') {
        const droppedItemId = await dragged.getText(DRAG_TYPE);
        if (droppedItemId && droppedItemId !== item.id) {
          props.onDropBefore(droppedItemId);
        }
      }
    },
  });

  return (
    <div
      ref={cardRef}
      {...(readonly ? {} : dragProps)}
      {...dropProps}
      role="button"
      tabIndex={0}
      aria-label={item.title}
      onKeyDown={event => {
        if (event.key === 'Enter' && event.target === cardRef.current) {
          actions.openItem(item.id);
        }
      }}
      style={{
        border: '1px solid var(--bui-border-1)',
        // never mix the border shorthand with a conditional longhand:
        // React serializes that into a broken style attribute
        boxShadow: isDropTarget
          ? '0 -3px 0 0 var(--bui-fg-link)'
          : undefined,
        borderRadius: 8,
        padding: 8,
        background: 'var(--bui-bg-neutral-1)',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'pointer',
      }}
      onClick={() => actions.openItem(item.id)}
      onContextMenu={props.onContextMenu}
    >
      <Flex align="center" gap="2" justify="between">
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
        <div
          style={{ flexGrow: 1, minWidth: 0 }}
          onClick={e => {
            // clicks on the inline-editable text must not open the
            // drawer, but the empty area beside it should
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              actions.openItem(item.id);
            }
          }}
        >
          <InlineEdit
            value={item.title}
            canEdit={!readonly}
            ariaLabel={`title of ${item.title}`}
            onCommit={title => actions.renameItem(item.id, title)}
            display={
              <Text variant="body-medium" weight="bold">
                {item.title}
              </Text>
            }
          />
        </div>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
        <div onClick={event => event.stopPropagation()}>
          <MenuTrigger>
            <ButtonIcon
              aria-label={`Actions for ${item.title}`}
              variant="tertiary"
              size="small"
              icon={<MoreIcon />}
            />
            <ItemMenu
              item={item}
              columns={columns}
              readonly={readonly}
              actions={actions}
              assigneePool={props.assigneePool}
            />
          </MenuTrigger>
        </div>
      </Flex>
      {item.externalManager && (
        <Text variant="body-x-small" color="secondary">
          Managed by {item.externalManager} (read-only)
        </Text>
      )}
      <DueDateBadge dueDate={item.dueDate} />
      <AssigneeAvatars refs={item.assignees} />
      {item.tags.length > 0 && (
        <Text variant="body-x-small" color="secondary">
          {item.tags.join(', ')}
        </Text>
      )}
    </div>
  );
}

function AddItemRow(props: {
  columnId: string;
  actions: BoardActions;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const fieldRef = useRef<HTMLDivElement>(null);
  if (!adding) {
    return (
      <Button
        variant="tertiary"
        size="small"
        onPress={() => setAdding(true)}
        aria-label="Add item"
      >
        + Add item
      </Button>
    );
  }
  const commit = async (options?: { addAnother?: boolean }) => {
    const value = title.trim();
    setTitle('');
    if (!value || !options?.addAnother) {
      // empty submit or focus left the form: close it
      setAdding(false);
    }
    if (value) {
      await props.actions.createItem(props.columnId, value);
      if (options?.addAnother) {
        // stay open for the next item; refocus after the re-render
        requestAnimationFrame(() =>
          fieldRef.current?.querySelector('input')?.focus(),
        );
      }
    }
  };
  return (
    <div ref={fieldRef}>
      <TextField
        aria-label="New item title"
        value={title}
        onChange={setTitle}
        placeholder="Item title"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
        autoFocus
        onBlur={() => commit()}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit({ addAnother: true });
          } else if (event.key === 'Escape') {
            setAdding(false);
            setTitle('');
          }
        }}
      />
    </div>
  );
}

function ColumnLane(props: {
  board: BoardWithContext;
  column: BoardColumn;
  items: BoardItem[];
  canWrite: boolean;
  actions: BoardActions;
  groupBy: GroupByMode;
  onRequestDelete: (column: BoardColumn, hasItems: boolean) => void;
  onItemContextMenu: (item: BoardItem, event: React.MouseEvent) => void;
  assigneePool: string[];
}) {
  const { board, column, items, canWrite, actions, groupBy } = props;
  const laneRef = useRef<HTMLDivElement>(null);
  const sorted = [...items].sort((a, b) => a.position - b.position);

  const { dropProps, isDropTarget } = useDrop({
    ref: laneRef,
    onDrop: async event => {
      const dragged = event.items.find(
        entry => entry.kind === 'text' && entry.types.has(DRAG_TYPE),
      );
      if (dragged && dragged.kind === 'text') {
        const itemId = await dragged.getText(DRAG_TYPE);
        if (itemId) {
          await actions.moveItem(itemId, { columnId: column.id });
        }
      }
    },
  });

  const index = board.columns.findIndex(c => c.id === column.id);

  const renderCard = (item: BoardItem) => (
    <ItemCard
      key={`${item.id}`}
      item={item}
      columns={board.columns}
      canWrite={canWrite}
      actions={actions}
      assigneePool={props.assigneePool}
      onDropBefore={droppedItemId => {
        const itemIndex = sorted.findIndex(entry => entry.id === item.id);
        actions.moveItem(droppedItemId, {
          columnId: column.id,
          position: positionBefore(sorted, itemIndex),
        });
      }}
      onContextMenu={event => props.onItemContextMenu(item, event)}
    />
  );

  return (
    <div
      ref={laneRef}
      {...dropProps}
      style={{
        minWidth: 280,
        width: 280,
        flexShrink: 0,
        background: isDropTarget
          ? 'var(--bui-bg-neutral-3)'
          : 'var(--bui-bg-neutral-2)',
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <Flex align="center" justify="between" gap="2">
        <Flex align="center" gap="2">
          <ColumnDot column={column} />
          <InlineEdit
            value={column.title}
            canEdit={canWrite}
            ariaLabel={`column ${column.title} title`}
            onCommit={title => actions.renameColumn(column.id, title)}
            display={
              <Text variant="body-medium" weight="bold">
                {column.title} ({items.length})
              </Text>
            }
          />
        </Flex>
        {canWrite && (
          <MenuTrigger>
            <ButtonIcon
              aria-label={`Actions for column ${column.title}`}
              variant="tertiary"
              size="small"
              icon={<MoreIcon />}
            />
            <Menu placement="right top">
              {index > 0 && (
                <MenuItem
                  onAction={() =>
                    actions.reorderColumn(
                      column.id,
                      positionBefore(board.columns, index - 1),
                    )
                  }
                >
                  Move left
                </MenuItem>
              )}
              {index < board.columns.length - 1 && (
                <MenuItem
                  onAction={() =>
                    actions.reorderColumn(
                      column.id,
                      positionBefore(board.columns, index + 2),
                    )
                  }
                >
                  Move right
                </MenuItem>
              )}
              <SubmenuTrigger>
                <MenuItem>Color</MenuItem>
                <Menu>
                  {(Object.keys(COLUMN_COLORS) as ColumnColor[]).map(color => (
                    <MenuItem
                      key={color}
                      textValue={color}
                      onAction={() => actions.setColumnColor(column.id, color)}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: COLUMN_COLORS[color],
                            display: 'inline-block',
                          }}
                        />
                        {color}
                        {column.color === color ? ' ✓' : ''}
                      </span>
                    </MenuItem>
                  ))}
                  <MenuItem
                    onAction={() => actions.setColumnColor(column.id, null)}
                  >
                    No color
                  </MenuItem>
                </Menu>
              </SubmenuTrigger>
              <MenuItem
                onAction={() =>
                  props.onRequestDelete(column, items.length > 0)
                }
              >
                Delete column
              </MenuItem>
            </Menu>
          </MenuTrigger>
        )}
      </Flex>
      {groupBy !== 'none'
        ? groupItems(sorted, groupBy).map(group => (
            <div key={group.key}>
              <Text variant="body-x-small" color="secondary">
                <GroupLabel mode={groupBy} groupKey={group.key} />
              </Text>
              <Flex direction="column" gap="2">
                {group.items.map(renderCard)}
              </Flex>
            </div>
          ))
        : sorted.map(renderCard)}
      {canWrite && <AddItemRow columnId={column.id} actions={actions} />}
    </div>
  );
}

export function KanbanView(props: {
  board: BoardWithContext;
  items: BoardItem[];
  canWrite: boolean;
  actions: BoardActions;
  groupBy: GroupByMode;
}) {
  const { board, items, canWrite, actions, groupBy } = props;
  const assigneePool = [...new Set(items.flatMap(item => item.assignees))];
  const contextMenu = useRowContextMenu<BoardItem>();
  const [deleteTarget, setDeleteTarget] = useState<BoardColumn | undefined>();
  const [moveItemsTo, setMoveItemsTo] = useState<string | undefined>();
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnTitle, setColumnTitle] = useState('');

  const commitColumn = async () => {
    const value = columnTitle.trim();
    setAddingColumn(false);
    setColumnTitle('');
    if (value) {
      await actions.addColumn(value);
    }
  };

  return (
    <Flex gap="3" align="start" style={{ overflowX: 'auto', paddingBottom: 8 }}>
      {board.columns.map(column => (
        <ColumnLane
          key={column.id}
          board={board}
          column={column}
          items={items.filter(item => item.columnId === column.id)}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          assigneePool={assigneePool}
          onItemContextMenu={contextMenu.open}
          onRequestDelete={(target, hasItems) => {
            if (hasItems) {
              setDeleteTarget(target);
              setMoveItemsTo(undefined);
            } else {
              actions.deleteColumn(target.id);
            }
          }}
        />
      ))}
      {canWrite &&
        board.columns.length === 0 &&
        (addingColumn ? (
          <div style={{ minWidth: 200 }}>
            <TextField
              aria-label="New column title"
              value={columnTitle}
              onChange={setColumnTitle}
              placeholder="Column title"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
              autoFocus
              onBlur={commitColumn}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitColumn();
                } else if (event.key === 'Escape') {
                  setAddingColumn(false);
                  setColumnTitle('');
                }
              }}
            />
          </div>
        ) : (
          <Button
            variant="tertiary"
            onPress={() => setAddingColumn(true)}
            aria-label="Add column"
          >
            + Add column
          </Button>
        ))}
      <ItemContextMenu
        state={contextMenu.state}
        onClose={contextMenu.close}
        columns={board.columns}
        readonly={!canWrite || !!contextMenu.state?.row.externalManager}
        actions={actions}
        assigneePool={assigneePool}
      />
      <Dialog
        isOpen={deleteTarget !== undefined}
        onOpenChange={open => {
          if (!open) setDeleteTarget(undefined);
        }}
      >
        <DialogHeader>Delete column “{deleteTarget?.title}”</DialogHeader>
        <DialogBody>
          <Text>
            This column still contains items. Choose the column they should
            move to:
          </Text>
          <Select
            label="Move items to"
            options={board.columns
              .filter(column => column.id !== deleteTarget?.id)
              .map(column => ({ value: column.id, label: column.title }))}
            selectedKey={moveItemsTo ?? null}
            onSelectionChange={key => setMoveItemsTo(String(key))}
          />
        </DialogBody>
        <DialogFooter>
          <Flex gap="2">
            <Button variant="secondary" onPress={() => setDeleteTarget(undefined)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              destructive
              isDisabled={!moveItemsTo}
              onPress={async () => {
                if (deleteTarget && moveItemsTo) {
                  await actions.deleteColumn(deleteTarget.id, moveItemsTo);
                  setDeleteTarget(undefined);
                }
              }}
            >
              Move items and delete
            </Button>
          </Flex>
        </DialogFooter>
      </Dialog>
    </Flex>
  );
}

import { Fragment, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-aria';
import { RiMore2Fill } from '@remixicon/react';
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
} from '@backstage/ui';
import {
  BoardColumn,
  BoardItem,
  BoardPriority,
  BoardWithContext,
  ALL_COLUMN_COLORS,
  ColumnColor,
} from '@internal/plugin-boards-common';
import {
  assigneePool,
  GroupByMode,
  groupItems,
  positionBefore,
} from './grouping';
import { GroupLabel } from './GroupLabel';
import { ItemActions, ItemMenu } from './ItemMenu';
import { RowMenuHandle, useRowMenu } from './RowMenu';
import { InlineAddField, InlineEdit } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { ColorDot, ColumnDot, PriorityChip } from './StatusBadge';

const DRAG_TYPE = 'application/x-boards-item';

export interface BoardActions extends ItemActions {
  createItem: (columnId: string, title: string) => Promise<void>;
  renameColumn: (columnId: string, title: string) => Promise<void>;
  reorderColumn: (columnId: string, position: number) => Promise<void>;
  /** Appends a column when `position` is omitted, inserts it there otherwise. */
  addColumn: (title: string, position?: number) => Promise<void>;
  setColumnColor: (
    columnId: string,
    color: ColumnColor | null,
  ) => Promise<void>;
  deleteColumn: (columnId: string, moveItemsTo?: string) => Promise<void>;
  renameItem: (itemId: string, title: string) => Promise<void>;
}

function ItemCard(props: {
  item: BoardItem;
  priority?: BoardPriority;
  canWrite: boolean;
  actions: BoardActions;
  rowMenu: RowMenuHandle<BoardItem>;
  onDropBefore: (droppedItemId: string) => void;
}) {
  const { item, priority, canWrite, actions, rowMenu } = props;
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
        boxShadow: isDropTarget ? '0 -3px 0 0 var(--bui-fg-link)' : undefined,
        borderRadius: 8,
        padding: 8,
        background: 'var(--bui-bg-neutral-1)',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'pointer',
      }}
      onClick={() => actions.openItem(item.id)}
      onContextMenu={event => rowMenu.onContextMenu(item, event)}
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
          {rowMenu.rowActions(item)}
        </div>
      </Flex>
      {item.externalManager && (
        <Text variant="body-x-small" color="secondary">
          Managed by {item.externalManager} (read-only)
        </Text>
      )}
      {priority && (
        <div style={{ marginTop: 4 }}>
          <PriorityChip priority={priority} size="small" />
        </div>
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

function AddItemRow(props: { columnId: string; actions: BoardActions }) {
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
      <InlineAddField
        ariaLabel="New item title"
        placeholder="Item title"
        value={title}
        onChange={setTitle}
        onSubmit={() => commit({ addAnother: true })}
        onBlur={() => commit()}
        onCancel={() => {
          setAdding(false);
          setTitle('');
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
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  rowMenu: RowMenuHandle<BoardItem>;
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
      priority={board.priorities.find(p => p.id === item.priorityId)}
      canWrite={canWrite}
      actions={actions}
      rowMenu={props.rowMenu}
      onDropBefore={droppedItemId => {
        const itemIndex = sorted.findIndex(entry => entry.id === item.id);
        actions.moveItem(droppedItemId, {
          columnId: column.id,
          position: positionBefore(sorted, itemIndex),
        });
      }}
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
              icon={<RiMore2Fill size={16} />}
            />
            <Menu placement="right top">
              <MenuItem onAction={props.onInsertBefore}>
                Insert column before
              </MenuItem>
              <MenuItem onAction={props.onInsertAfter}>
                Insert column after
              </MenuItem>
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
                  {ALL_COLUMN_COLORS.map(color => (
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
                        <ColorDot color={color} />
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
                onAction={() => props.onRequestDelete(column, items.length > 0)}
              >
                Delete column
              </MenuItem>
            </Menu>
          </MenuTrigger>
        )}
      </Flex>
      {groupBy !== 'none'
        ? groupItems(sorted, groupBy, board.priorities).map(group => (
            <div key={group.key}>
              <Text variant="body-x-small" color="secondary">
                <GroupLabel
                  mode={groupBy}
                  groupKey={group.key}
                  priorities={board.priorities}
                  count={
                    groupBy === 'priority' ? group.items.length : undefined
                  }
                />
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

export function BoardView(props: {
  board: BoardWithContext;
  items: BoardItem[];
  canWrite: boolean;
  actions: BoardActions;
  groupBy: GroupByMode;
}) {
  const { board, items, canWrite, actions, groupBy } = props;
  const pool = assigneePool(items);
  const rowMenu = useRowMenu<BoardItem>({
    name: item => item.title,
    children: item => (
      <ItemMenu
        item={item}
        columns={board.columns}
        priorities={board.priorities}
        readonly={!canWrite || !!item.externalManager}
        actions={actions}
        assigneePool={pool}
      />
    ),
  });
  const [deleteTarget, setDeleteTarget] = useState<BoardColumn | undefined>();
  const [moveItemsTo, setMoveItemsTo] = useState<string | undefined>();
  // the slot the new column goes into, as an index into board.columns:
  // `n` means "before the column at n", so board.columns.length appends.
  // undefined means no column is being added.
  const [insertAt, setInsertAt] = useState<number | undefined>();
  const [columnTitle, setColumnTitle] = useState('');

  const cancelColumn = () => {
    setInsertAt(undefined);
    setColumnTitle('');
  };

  const commitColumn = async () => {
    const value = columnTitle.trim();
    const slot = insertAt;
    cancelColumn();
    if (!value || slot === undefined) {
      return;
    }
    // appending is left to the backend, which places the column after the
    // last one; only a gap needs a position worked out here
    await actions.addColumn(
      value,
      slot === board.columns.length
        ? undefined
        : positionBefore(board.columns, slot),
    );
  };

  const titleField = (
    <div style={{ minWidth: 200 }}>
      <InlineAddField
        ariaLabel="New column title"
        placeholder="Column title"
        value={columnTitle}
        onChange={setColumnTitle}
        onSubmit={commitColumn}
        onBlur={commitColumn}
        onCancel={cancelColumn}
      />
    </div>
  );

  return (
    <Flex gap="3" align="start" style={{ overflowX: 'auto', paddingBottom: 8 }}>
      {board.columns.map((column, index) => (
        <Fragment key={column.id}>
          {insertAt === index && titleField}
          <ColumnLane
            board={board}
            column={column}
            items={items.filter(item => item.columnId === column.id)}
            canWrite={canWrite}
            actions={actions}
            groupBy={groupBy}
            rowMenu={rowMenu}
            onInsertBefore={() => setInsertAt(index)}
            onInsertAfter={() => setInsertAt(index + 1)}
            onRequestDelete={(target, hasItems) => {
              if (hasItems) {
                setDeleteTarget(target);
                setMoveItemsTo(undefined);
              } else {
                actions.deleteColumn(target.id);
              }
            }}
          />
        </Fragment>
      ))}
      {insertAt === board.columns.length && titleField}
      {canWrite && board.columns.length === 0 && insertAt === undefined && (
        <Button
          variant="tertiary"
          onPress={() => setInsertAt(0)}
          aria-label="Add column"
        >
          + Add column
        </Button>
      )}
      {rowMenu.contextMenu}
      <Dialog
        isOpen={deleteTarget !== undefined}
        onOpenChange={open => {
          if (!open) setDeleteTarget(undefined);
        }}
      >
        <DialogHeader>Delete column “{deleteTarget?.title}”</DialogHeader>
        <DialogBody>
          <Text>
            This column still contains items. Choose the column they should move
            to:
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
            <Button
              variant="secondary"
              onPress={() => setDeleteTarget(undefined)}
            >
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

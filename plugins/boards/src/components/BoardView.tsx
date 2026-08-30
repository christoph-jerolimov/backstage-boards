import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useDrag, useDrop } from 'react-aria';
import type { DropItem } from 'react-aria';
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
import { handleItemShortcut, ItemShortcutContext } from './itemShortcuts';
import type { SelectionHandle } from './useItemSelection';
import {
  InlineAddField,
  InlineEdit,
  ChecklistBadge,
  DueDateBadge,
  ColorDot,
  ColumnDot,
  PriorityChip,
} from '@internal/plugin-boards-react';
import { AssigneeAvatars } from './AssigneeAvatars';

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

/** Reads the dragged item id out of a react-aria drop event. */
async function droppedItemId(event: {
  items: DropItem[];
}): Promise<string | undefined> {
  const dragged = event.items.find(
    entry => entry.kind === 'text' && entry.types.has(DRAG_TYPE),
  );
  if (dragged && dragged.kind === 'text') {
    return (await dragged.getText(DRAG_TYPE)) || undefined;
  }
  return undefined;
}

/** How the board's card focus and keyboard shortcuts reach each card. */
interface CardNav {
  selectedIds: ReadonlySet<string>;
  /** The card carrying the roving tab stop. */
  focusId?: string;
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    item: BoardItem,
    cardEl: HTMLDivElement,
  ) => void;
  onFocusItem: (item: BoardItem) => void;
  registerCard: (itemId: string, el: HTMLDivElement | null) => void;
}

/**
 * The drop target between two cards (and before the first / after the
 * last one): a slim zone that lights up as an insertion line while a
 * drag hovers it, showing exactly where the card will land. The zones
 * replace the lists' flex gap, so they add no extra spacing.
 */
function GapDropZone(props: {
  onDropItem: (itemId: string) => void;
  /** Lights the line without a direct hover (empty-column append). */
  forceActive?: boolean;
}) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref: zoneRef,
    onDrop: async event => {
      const itemId = await droppedItemId(event);
      if (itemId) {
        props.onDropItem(itemId);
      }
    },
  });
  const active = isDropTarget || props.forceActive;
  return (
    <div
      ref={zoneRef}
      {...dropProps}
      data-testid="gap-drop-zone"
      style={{
        height: 8,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: 3,
          width: '100%',
          borderRadius: 2,
          background: active ? 'var(--bui-bg-solid)' : 'transparent',
        }}
      />
    </div>
  );
}

function ItemCard(props: {
  item: BoardItem;
  priority?: BoardPriority;
  canWrite: boolean;
  actions: BoardActions;
  rowMenu: RowMenuHandle<BoardItem>;
  onDropBefore: (itemId: string) => void;
  nav: CardNav;
}) {
  const { item, priority, canWrite, actions, rowMenu, nav } = props;
  const readonly = !canWrite || !!item.externalManager;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const selected = nav.selectedIds.has(item.id);

  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ [DRAG_TYPE]: item.id }],
  });
  // react-aria's own keyboard drag mode claims Enter in the capture
  // phase; the card's keyboard model (menu on Enter, Ctrl+Arrow and the
  // move picker for moving) replaces it, so only pointer dragging stays
  const {
    onKeyDownCapture: _dragKeyDown,
    onKeyUpCapture: _dragKeyUp,
    ...pointerDragProps
  } = dragProps;

  const { dropProps, isDropTarget } = useDrop({
    ref: cardRef,
    onDrop: async event => {
      const itemId = await droppedItemId(event);
      if (itemId && itemId !== item.id) {
        props.onDropBefore(itemId);
      }
    },
  });

  // never mix the border shorthand with a conditional longhand: React
  // serializes that into a broken style attribute. The drop line marks
  // "lands before this card" (same visual as the gap zones); the inset
  // ring marks the bulk selection.
  const shadows = [
    isDropTarget ? '0 -3px 0 0 var(--bui-bg-solid)' : undefined,
    selected ? 'inset 0 0 0 2px var(--bui-bg-solid)' : undefined,
  ].filter(Boolean);

  return (
    <div
      ref={el => {
        cardRef.current = el;
        nav.registerCard(item.id, el);
      }}
      {...(readonly ? {} : pointerDragProps)}
      {...dropProps}
      role="button"
      tabIndex={nav.focusId === item.id ? 0 : -1}
      data-board-card
      aria-label={selected ? `${item.title}, selected` : item.title}
      onKeyDown={event => {
        // only keys on the card itself — not on a child editor or menu
        if (event.target === cardRef.current && cardRef.current) {
          nav.onKeyDown(event, item, cardRef.current);
        }
      }}
      onFocus={event => {
        if (event.target === cardRef.current) {
          nav.onFocusItem(item);
        }
      }}
      style={{
        border: '1px solid var(--bui-border-1)',
        boxShadow: shadows.length > 0 ? shadows.join(', ') : undefined,
        borderRadius: 8,
        padding: 8,
        background: 'var(--bui-bg-neutral-1)',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'pointer',
      }}
      onClick={() => actions.openItem(item.id)}
      onContextMenu={event => rowMenu.onContextMenu(item, event)}
    >
      <Flex direction="column" gap="1">
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
        {/* the compact indicators share one row; guarded so an item
            without any of them doesn't render an empty gap */}
        {(priority || item.dueDate || item.checklist.length > 0) && (
          <Flex align="baseline" gap="2" style={{ flexWrap: 'wrap' }}>
            {priority && <PriorityChip priority={priority} size="small" />}
            <DueDateBadge dueDate={item.dueDate} />
            <ChecklistBadge checklist={item.checklist} />
          </Flex>
        )}
        <AssigneeAvatars refs={item.assignees} />
        {item.tags.length > 0 && (
          <Text variant="body-x-small" color="secondary">
            {item.tags.join(', ')}
          </Text>
        )}
      </Flex>
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
  nav: CardNav;
}) {
  const { board, column, items, canWrite, actions, groupBy, nav } = props;
  const laneRef = useRef<HTMLDivElement>(null);
  const sorted = [...items].sort((a, b) => a.position - b.position);

  const { dropProps, isDropTarget } = useDrop({
    ref: laneRef,
    onDrop: async event => {
      const itemId = await droppedItemId(event);
      if (itemId) {
        await actions.moveItem(itemId, { columnId: column.id });
      }
    },
  });

  const index = board.columns.findIndex(c => c.id === column.id);

  // Drops always compute their rank against the visible order of the
  // section they land in — the group's items when the lane is grouped,
  // the whole lane otherwise — so the card lands exactly where the
  // insertion line showed it.
  const dropAt = (itemId: string, section: BoardItem[], at: number) => {
    if (section[at]?.id === itemId || section[at - 1]?.id === itemId) {
      // dropped right where it already sits
      return;
    }
    actions.moveItem(itemId, {
      columnId: column.id,
      position: positionBefore(section, at),
    });
  };

  const renderCard = (item: BoardItem, section: BoardItem[]) => (
    <ItemCard
      key={`${item.id}`}
      item={item}
      priority={board.priorities.find(p => p.id === item.priorityId)}
      canWrite={canWrite}
      actions={actions}
      rowMenu={props.rowMenu}
      nav={nav}
      onDropBefore={itemId => {
        const itemIndex = section.findIndex(entry => entry.id === item.id);
        dropAt(itemId, section, itemIndex);
      }}
    />
  );

  // The gap zones replace the list's former flex gap: 8px each, with the
  // section's margins cancelling the lane's outer gap so the leading and
  // trailing zones sit exactly where the old spacing was.
  const renderSection = (section: BoardItem[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '-8px 0' }}>
      {section.map((item, at) => (
        <Fragment key={item.id}>
          <GapDropZone onDropItem={itemId => dropAt(itemId, section, at)} />
          {renderCard(item, section)}
        </Fragment>
      ))}
      <GapDropZone
        onDropItem={itemId => dropAt(itemId, section, section.length)}
        forceActive={section.length === 0 && isDropTarget}
      />
    </div>
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
      {groupBy !== 'none' && sorted.length > 0
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
              {renderSection(group.items)}
            </div>
          ))
        : renderSection(sorted)}
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
  /** The page's shared bulk selection; absent for readers. */
  selection?: SelectionHandle;
}) {
  const { board, items, canWrite, actions, groupBy, selection } = props;
  const pool = assigneePool(items);
  const rowMenu = useRowMenu<BoardItem>({
    name: item => item.title,
    children: (item, submenu) => (
      <ItemMenu
        item={item}
        columns={board.columns}
        priorities={board.priorities}
        readonly={!canWrite || !!item.externalManager}
        actions={actions}
        assigneePool={pool}
        submenu={submenu}
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

  // ---- card focus: one roving tab stop plus arrow-key navigation ----
  const [focusedItemId, setFocusedItemId] = useState<string | undefined>();
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  // set by keyboard actions whose re-render unmounts the focused card
  // (a move to another lane, an archive), consumed by the effect below
  const pendingRefocus = useRef(false);

  // the visible card order of every column, mirroring what the lanes
  // render; an item shown in several groups is visited once
  const columnLists = useMemo(() => {
    return board.columns.map(column => {
      const sorted = items
        .filter(item => item.columnId === column.id)
        .sort((a, b) => a.position - b.position);
      const flat =
        groupBy === 'none'
          ? sorted
          : groupItems(sorted, groupBy, board.priorities).flatMap(
              group => group.items,
            );
      const seen = new Set<string>();
      const list: BoardItem[] = [];
      for (const item of flat) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
      return list;
    });
  }, [board.columns, board.priorities, items, groupBy]);

  // the card carrying tabIndex 0: the focused card while it exists,
  // otherwise the first card of the first non-empty column
  const effectiveFocusId =
    focusedItemId && items.some(item => item.id === focusedItemId)
      ? focusedItemId
      : columnLists.find(list => list.length > 0)?.[0]?.id;

  const focusItem = (itemId: string) => {
    setFocusedItemId(itemId);
    cardRefs.current.get(itemId)?.focus();
  };

  const placeOf = (item: BoardItem) => {
    const columnIndex = board.columns.findIndex(
      column => column.id === item.columnId,
    );
    const list = columnLists[columnIndex] ?? [];
    return {
      columnIndex,
      list,
      index: list.findIndex(entry => entry.id === item.id),
    };
  };

  const focusSideways = (item: BoardItem, delta: 1 | -1) => {
    const { columnIndex, index } = placeOf(item);
    for (
      let next = columnIndex + delta;
      next >= 0 && next < columnLists.length;
      next += delta
    ) {
      const list = columnLists[next];
      if (list.length > 0) {
        focusItem(list[Math.min(Math.max(index, 0), list.length - 1)].id);
        return;
      }
    }
  };

  // where the focus goes when the focused item is archived: the next
  // card in the column, else the previous, else a neighbouring column
  const successorOf = (item: BoardItem): string | undefined => {
    const { columnIndex, list, index } = placeOf(item);
    const inColumn = list[index + 1] ?? list[index - 1];
    if (inColumn) {
      return inColumn.id;
    }
    for (const delta of [1, -1]) {
      for (
        let next = columnIndex + delta;
        next >= 0 && next < columnLists.length;
        next += delta
      ) {
        if (columnLists[next].length > 0) {
          return columnLists[next][0].id;
        }
      }
    }
    return undefined;
  };

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    item: BoardItem,
    cardEl: HTMLDivElement,
  ) => {
    const ctx: ItemShortcutContext = {
      columns: board.columns,
      priorities: board.priorities,
      readonly: !canWrite || !!item.externalManager,
      actions,
      selection,
      openMenu: kind => {
        pendingRefocus.current = true;
        rowMenu.openForRow(item, cardEl, kind === 'menu' ? undefined : kind);
      },
      onBeforeArchive: () => {
        const successor = successorOf(item);
        if (successor) {
          setFocusedItemId(successor);
        }
        pendingRefocus.current = true;
      },
      onAfterMove: () => {
        pendingRefocus.current = true;
      },
    };
    if (handleItemShortcut(event, item, ctx)) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return;
    }
    const { list, index } = placeOf(item);
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) {
          focusItem(list[index - 1].id);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (index >= 0 && index < list.length - 1) {
          focusItem(list[index + 1].id);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusSideways(item, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        focusSideways(item, 1);
        break;
      default:
        break;
    }
  };

  // re-focus after a keyboard action re-rendered the focused card away:
  // a cross-lane move remounts it, an archive replaces it with its
  // successor. Only fires while focus fell back to the body, so it never
  // steals a focus the user moved elsewhere.
  useEffect(() => {
    if (!pendingRefocus.current) {
      return;
    }
    const el = effectiveFocusId
      ? cardRefs.current.get(effectiveFocusId)
      : undefined;
    if (!el || document.activeElement === el) {
      pendingRefocus.current = false;
      return;
    }
    if (document.activeElement === document.body) {
      pendingRefocus.current = false;
      el.focus();
    }
    // while focus still sits on the outgoing card, keep the intent
    // pending for the re-render that unmounts it
  }, [items, effectiveFocusId]);

  const nav: CardNav = {
    selectedIds: selection?.selected ?? new Set(),
    focusId: effectiveFocusId,
    onKeyDown: handleCardKeyDown,
    onFocusItem: item => setFocusedItemId(item.id),
    registerCard: (itemId, el) => {
      if (el) {
        cardRefs.current.set(itemId, el);
      } else {
        cardRefs.current.delete(itemId);
      }
    },
  };

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
      <style>{`
        [data-board-card]:focus-visible {
          outline: 2px solid var(--bui-bg-solid);
          outline-offset: 1px;
        }
      `}</style>
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
            nav={nav}
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

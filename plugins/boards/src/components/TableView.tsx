import { Fragment, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { VisuallyHidden } from 'react-aria';
import {
  Cell,
  Checkbox,
  Column,
  Flex,
  Row,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import { BoardItem, BoardWithContext } from '@internal/plugin-boards-common';
import {
  assigneePool,
  GroupByMode,
  groupItems,
  ITEM_SORT_COLUMNS,
  ItemSortDescriptor,
  sortItems,
  toItemSortDescriptor,
} from './grouping';
import { GroupLabel } from './GroupLabel';
import {
  ColumnsMenu,
  TABLE_COLUMNS,
  TableColumnId,
  useVisibleColumns,
} from './tableColumns';
import { ItemMenu } from './ItemMenu';
import {
  ActionsCellContent,
  RowMenuHandle,
  useRowMenu,
  utilityColumnStyle,
} from './RowMenu';
import { handleItemShortcut, ItemShortcutContext } from './itemShortcuts';
import type { SelectionHandle } from './useItemSelection';
import type { BoardActions } from './BoardView';
import { formatDate, RefDisplay } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { PriorityChip, StatusBadge } from './StatusBadge';

const SORTABLE_COLUMNS = new Set<TableColumnId>(ITEM_SORT_COLUMNS);

function ItemsTable(props: {
  board: BoardWithContext;
  items: BoardItem[];
  /** The user's visible columns, already resolved in display order. */
  visibleColumns: ReadonlyArray<(typeof TABLE_COLUMNS)[number]>;
  openItem: (itemId: string) => void;
  rowMenu: RowMenuHandle<BoardItem>;
  sort: ItemSortDescriptor | undefined;
  onSortChange: (descriptor: ItemSortDescriptor) => void;
  /** Row selection; absent for readers, who get no checkbox column. */
  selection?: SelectionHandle;
}) {
  const {
    board,
    items,
    visibleColumns,
    openItem,
    rowMenu,
    sort,
    onSortChange,
    selection,
  } = props;
  const columnOf = (columnId: string) =>
    board.columns.find(column => column.id === columnId);
  const priorityOf = (item: BoardItem) =>
    board.priorities.find(priority => priority.id === item.priorityId);
  const sorted = sortItems(items, sort, board.columns);
  // externally managed items are read-only, so select-all skips them
  const selectable = sorted.filter(item => !item.externalManager);
  const selectedHere = selectable.filter(item =>
    selection?.selected.has(item.id),
  );
  const allSelected =
    selectable.length > 0 && selectedHere.length === selectable.length;
  const cellContent = (id: TableColumnId, item: BoardItem) => {
    switch (id) {
      case 'title':
        return (
          <>
            {item.title}
            {item.externalManager ? ` (via ${item.externalManager})` : ''}
          </>
        );
      case 'status':
        return <StatusBadge column={columnOf(item.columnId)} />;
      case 'priority':
        return <PriorityChip priority={priorityOf(item)} />;
      case 'dueDate':
        return <DueDateBadge dueDate={item.dueDate} />;
      case 'assignees':
        return <AssigneeAvatars refs={item.assignees} />;
      case 'tags':
        return item.tags.join(', ');
      case 'createdBy':
        return <RefDisplay refString={item.createdBy} />;
      case 'createdAt':
        return formatDate(item.createdAt);
      case 'updatedBy':
        return <RefDisplay refString={item.updatedBy} />;
      case 'updatedAt':
        return formatDate(item.updatedAt);
      default:
        return null;
    }
  };
  return (
    <TableRoot
      aria-label="Board items"
      onRowAction={key => openItem(String(key))}
      sortDescriptor={sort}
      onSortChange={descriptor => {
        const next = toItemSortDescriptor(descriptor);
        if (next) {
          onSortChange(next);
        }
      }}
    >
      <TableHeader>
        {selection ? (
          // a utility column like the actions one: checkbox-narrow
          <Column style={utilityColumnStyle}>
            <Checkbox
              // opt out of the table's slotted selection context — this
              // checkbox drives the view's own id-based selection
              slot={null}
              aria-label="Select all items"
              isSelected={allSelected}
              isIndeterminate={selectedHere.length > 0 && !allSelected}
              onChange={() =>
                allSelected
                  ? selection.setMany(
                      sorted.map(item => item.id),
                      false,
                    )
                  : selection.setMany(
                      selectable.map(item => item.id),
                      true,
                    )
              }
            />
          </Column>
        ) : null}
        {visibleColumns.map(column => (
          <Column
            key={column.id}
            id={column.id}
            isRowHeader={column.id === 'title'}
            allowsSorting={SORTABLE_COLUMNS.has(column.id)}
          >
            {column.label}
          </Column>
        ))}
        <Column style={utilityColumnStyle}>
          <VisuallyHidden>Actions</VisuallyHidden>
        </Column>
      </TableHeader>
      <TableBody>
        {sorted.map(item => (
          <Row
            key={item.id}
            id={item.id}
            onContextMenu={(event: React.MouseEvent) =>
              rowMenu.onContextMenu(item, event)
            }
          >
            {selection ? (
              <Cell>
                <Checkbox
                  slot={null}
                  aria-label={`Select ${item.title}`}
                  isSelected={selection.selected.has(item.id)}
                  isDisabled={!!item.externalManager}
                  onChange={() => selection.toggleItem(item.id)}
                />
              </Cell>
            ) : null}
            {visibleColumns.map(column => (
              <Cell key={column.id}>{cellContent(column.id, item)}</Cell>
            ))}
            <Cell>
              <ActionsCellContent>
                {rowMenu.rowActions(item)}
              </ActionsCellContent>
            </Cell>
          </Row>
        ))}
      </TableBody>
    </TableRoot>
  );
}

export function TableView(props: {
  board: BoardWithContext;
  items: BoardItem[];
  canWrite: boolean;
  actions: BoardActions;
  groupBy: GroupByMode;
  openItem: (itemId: string) => void;
  /** The page's shared bulk selection; absent for readers. */
  selection?: SelectionHandle;
  /** Columns at their hard WIP limit: move entries into them disable. */
  fullColumnIds?: Set<string>;
  /** Controlled sort state; the page owns it so the drawer nav can
   * mirror the table's order. Uncontrolled when omitted. */
  sort?: ItemSortDescriptor;
  onSortChange?: (descriptor: ItemSortDescriptor | undefined) => void;
}) {
  const { board, items, canWrite, actions, groupBy, openItem, selection } =
    props;
  const pool = assigneePool(items);
  const [ownSort, setOwnSort] = useState<ItemSortDescriptor | undefined>(
    undefined,
  );
  const sort = props.onSortChange ? props.sort : ownSort;
  const setSort = props.onSortChange ?? setOwnSort;
  const rowMenu = useRowMenu<BoardItem>({
    name: item => item.title,
    children: (item, submenu) => (
      <ItemMenu
        item={item}
        columns={board.columns}
        priorities={board.priorities}
        fullColumnIds={props.fullColumnIds}
        readonly={!canWrite || !!item.externalManager}
        actions={actions}
        assigneePool={pool}
        submenu={submenu}
      />
    ),
  });
  // one decision for the whole view, so every group shows the same columns
  const showPriority = items.some(item => item.priorityId);
  const [visible, toggleColumn] = useVisibleColumns(board.id);
  const visibleColumns = TABLE_COLUMNS.filter(column =>
    visible.has(column.id),
  ).filter(column => column.id !== 'priority' || showPriority);
  const columnsMenu = (
    <Flex justify="end">
      <ColumnsMenu
        visible={visible}
        onToggle={toggleColumn}
        showPriority={showPriority}
      />
    </Flex>
  );

  const groups =
    groupBy === 'none'
      ? [{ key: 'all', items }]
      : groupItems(items, groupBy, board.priorities);

  // ---- row focus: arrows walk all rendered rows, across the groups ----

  const wrapRef = useRef<HTMLDivElement | null>(null);
  // the items behind the rendered rows, in DOM order: each group's table
  // sorts exactly like ItemsTable does, so index n here is row n there.
  // An item shown in several groups appears once per row.
  const flatItems = groups.flatMap(group =>
    sortItems(group.items, sort, board.columns),
  );
  // where the keyboard focus should land after a mutation re-renders the
  // rows (an archive's successor, a regrouped item), consumed below
  const pendingFocusId = useRef<string | undefined>(undefined);

  const allRows = () =>
    Array.from(
      wrapRef.current?.querySelectorAll<HTMLElement>('tbody tr') ?? [],
    );
  const focusRowAt = (index: number) => {
    allRows()[index]?.focus();
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    // only keys on a row itself — cells, editors, and menus keep theirs
    if (target.closest('tbody tr') !== target) {
      return;
    }
    const rows = allRows();
    const index = rows.indexOf(target);
    const item = flatItems[index];
    if (index < 0 || !item || rows.length !== flatItems.length) {
      return;
    }
    const ctx: ItemShortcutContext = {
      columns: board.columns,
      priorities: board.priorities,
      readonly: !canWrite || !!item.externalManager,
      actions,
      selection,
      fullColumnIds: props.fullColumnIds,
      openMenu: kind => {
        rowMenu.openForRow(item, target, kind === 'menu' ? undefined : kind);
      },
      onBeforeArchive: () => {
        pendingFocusId.current =
          flatItems[index + 1]?.id ?? flatItems[index - 1]?.id;
      },
      onAfterMove: () => {
        pendingFocusId.current = item.id;
      },
    };
    // capture phase: a handled key stops before react-aria's own row
    // handling (Enter/Space would otherwise also trigger the row action)
    if (handleItemShortcut(event, item, ctx)) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        focusRowAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        focusRowAt(index - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        // no item navigation sideways in the table view
        event.preventDefault();
        event.stopPropagation();
        break;
      default:
        break;
    }
  };

  // re-focus after a keyboard action re-rendered the focused row away
  // (archive, or a change that moved the item between groups). Only
  // fires while focus fell back to the body, never stealing a focus the
  // user moved elsewhere.
  useEffect(() => {
    const itemId = pendingFocusId.current;
    if (!itemId) {
      return;
    }
    pendingFocusId.current = undefined;
    if (document.activeElement !== document.body) {
      return;
    }
    const index = flatItems.findIndex(item => item.id === itemId);
    if (index >= 0) {
      focusRowAt(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort, groupBy]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={wrapRef} onKeyDownCapture={handleKeyDownCapture}>
      <style>{`
        tbody tr[data-focus-visible] {
          outline: 2px solid var(--bui-bg-solid);
          outline-offset: -2px;
        }
      `}</style>
      <Flex direction="column" gap="2">
        {columnsMenu}
        {groups.map(group => (
          <Fragment key={group.key}>
            {groupBy !== 'none' && (
              <Text variant="body-medium" weight="bold" as="h3">
                <GroupLabel
                  mode={groupBy}
                  groupKey={group.key}
                  priorities={board.priorities}
                  count={
                    groupBy === 'priority' ? group.items.length : undefined
                  }
                />
              </Text>
            )}
            <ItemsTable
              board={board}
              items={group.items}
              visibleColumns={visibleColumns}
              openItem={openItem}
              rowMenu={rowMenu}
              sort={sort}
              onSortChange={setSort}
              selection={selection}
            />
          </Fragment>
        ))}
        {rowMenu.contextMenu}
      </Flex>
    </div>
  );
}

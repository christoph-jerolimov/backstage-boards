import { Fragment, useState } from 'react';
import {
  Cell,
  Checkbox,
  Column,
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
  ItemSortDescriptor,
  sortItems,
  toItemSortDescriptor,
} from './grouping';
import { GroupLabel } from './GroupLabel';
import { ItemMenu } from './ItemMenu';
import { RowMenuHandle, useRowMenu } from './RowMenu';
import type { BoardActions } from './BoardView';
import type { BulkActions } from './useBoardActions';
import { BulkActionsBar } from './BulkActionsBar';
import { formatDate, RefDisplay } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { PriorityChip, StatusBadge } from './StatusBadge';

/** The shared item-id selection every group's table renders and edits. */
interface SelectionHandle {
  selected: ReadonlySet<string>;
  toggleItem: (itemId: string) => void;
  setMany: (itemIds: string[], on: boolean) => void;
}

function ItemsTable(props: {
  board: BoardWithContext;
  items: BoardItem[];
  /** Render the priority column; on when any listed item has one. */
  showPriority: boolean;
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
    showPriority,
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
          <Column>
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
        <Column id="title" isRowHeader allowsSorting>
          Title
        </Column>
        <Column id="status" allowsSorting>
          Status
        </Column>
        {showPriority ? <Column>Priority</Column> : null}
        <Column id="dueDate" allowsSorting>
          Due
        </Column>
        <Column>Assignees</Column>
        <Column>Tags</Column>
        <Column id="createdBy" allowsSorting>
          Created by
        </Column>
        <Column id="updatedAt" allowsSorting>
          Updated
        </Column>
        <Column>Actions</Column>
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
            <Cell>
              {item.title}
              {item.externalManager ? ` (via ${item.externalManager})` : ''}
            </Cell>
            <Cell>
              <StatusBadge column={columnOf(item.columnId)} />
            </Cell>
            {showPriority ? (
              <Cell>
                <PriorityChip priority={priorityOf(item)} />
              </Cell>
            ) : null}
            <Cell>
              <DueDateBadge dueDate={item.dueDate} />
            </Cell>
            <Cell>
              <AssigneeAvatars refs={item.assignees} />
            </Cell>
            <Cell>{item.tags.join(', ')}</Cell>
            <Cell>
              <RefDisplay refString={item.createdBy} />
            </Cell>
            <Cell>{formatDate(item.updatedAt)}</Cell>
            <Cell>{rowMenu.rowActions(item)}</Cell>
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
  bulk: BulkActions;
  groupBy: GroupByMode;
  openItem: (itemId: string) => void;
}) {
  const { board, items, canWrite, actions, bulk, groupBy, openItem } = props;
  const pool = assigneePool(items);
  const [sort, setSort] = useState<ItemSortDescriptor | undefined>(undefined);
  // selection is a set of item ids: grouping only re-partitions the same
  // items, so it survives a group-by change, and an item shown in several
  // groups is one selection; ids of vanished items simply stop matching
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const selection: SelectionHandle | undefined = canWrite
    ? {
        selected,
        toggleItem: itemId =>
          setSelected(current => {
            const next = new Set(current);
            if (!next.delete(itemId)) {
              next.add(itemId);
            }
            return next;
          }),
        setMany: (itemIds, on) =>
          setSelected(current => {
            const next = new Set(current);
            for (const itemId of itemIds) {
              if (on) {
                next.add(itemId);
              } else {
                next.delete(itemId);
              }
            }
            return next;
          }),
      }
    : undefined;
  const selectedItems = canWrite
    ? items.filter(item => selected.has(item.id))
    : [];
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
  // one decision for the whole view, so every group shows the same columns
  const showPriority = items.some(item => item.priorityId);
  const bulkBar =
    selectedItems.length > 0 ? (
      <BulkActionsBar
        board={board}
        selectedItems={selectedItems}
        assigneePool={pool}
        bulk={bulk}
        onClear={() => setSelected(new Set())}
      />
    ) : null;
  if (groupBy === 'none') {
    return (
      <>
        {bulkBar}
        <ItemsTable
          board={board}
          items={items}
          showPriority={showPriority}
          openItem={openItem}
          rowMenu={rowMenu}
          sort={sort}
          onSortChange={setSort}
          selection={selection}
        />
        {rowMenu.contextMenu}
      </>
    );
  }
  return (
    <>
      {bulkBar}
      {groupItems(items, groupBy, board.priorities).map(group => (
        <Fragment key={group.key}>
          <Text variant="body-medium" weight="bold" as="h3">
            <GroupLabel
              mode={groupBy}
              groupKey={group.key}
              priorities={board.priorities}
              count={groupBy === 'priority' ? group.items.length : undefined}
            />
          </Text>
          <ItemsTable
            board={board}
            items={group.items}
            showPriority={showPriority}
            openItem={openItem}
            rowMenu={rowMenu}
            sort={sort}
            onSortChange={setSort}
            selection={selection}
          />
        </Fragment>
      ))}
      {rowMenu.contextMenu}
    </>
  );
}

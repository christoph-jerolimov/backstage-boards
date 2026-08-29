import { Fragment, useState } from 'react';
import { VisuallyHidden } from 'react-aria';
import {
  Cell,
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
}) {
  const {
    board,
    items,
    visibleColumns,
    openItem,
    rowMenu,
    sort,
    onSortChange,
  } = props;
  const columnOf = (columnId: string) =>
    board.columns.find(column => column.id === columnId);
  const priorityOf = (item: BoardItem) =>
    board.priorities.find(priority => priority.id === item.priorityId);
  const sorted = sortItems(items, sort, board.columns);
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
}) {
  const { board, items, canWrite, actions, groupBy, openItem } = props;
  const pool = assigneePool(items);
  const [sort, setSort] = useState<ItemSortDescriptor | undefined>(undefined);
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
  if (groupBy === 'none') {
    return (
      <Flex direction="column" gap="2">
        {columnsMenu}
        <ItemsTable
          board={board}
          items={items}
          visibleColumns={visibleColumns}
          openItem={openItem}
          rowMenu={rowMenu}
          sort={sort}
          onSortChange={setSort}
        />
        {rowMenu.contextMenu}
      </Flex>
    );
  }
  return (
    <Flex direction="column" gap="2">
      {columnsMenu}
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
            visibleColumns={visibleColumns}
            openItem={openItem}
            rowMenu={rowMenu}
            sort={sort}
            onSortChange={setSort}
          />
        </Fragment>
      ))}
      {rowMenu.contextMenu}
    </Flex>
  );
}

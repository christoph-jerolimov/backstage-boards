import { Fragment, useState } from 'react';
import {
  Cell,
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
import { formatDate, RefDisplay } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { PriorityChip, StatusBadge } from './StatusBadge';

function ItemsTable(props: {
  board: BoardWithContext;
  items: BoardItem[];
  /** Render the priority column; on when any listed item has one. */
  showPriority: boolean;
  openItem: (itemId: string) => void;
  rowMenu: RowMenuHandle<BoardItem>;
  sort: ItemSortDescriptor | undefined;
  onSortChange: (descriptor: ItemSortDescriptor) => void;
}) {
  const { board, items, showPriority, openItem, rowMenu, sort, onSortChange } =
    props;
  const columnOf = (columnId: string) =>
    board.columns.find(column => column.id === columnId);
  const priorityOf = (item: BoardItem) =>
    board.priorities.find(priority => priority.id === item.priorityId);
  const sorted = sortItems(items, sort, board.columns);
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
  if (groupBy === 'none') {
    return (
      <>
        <ItemsTable
          board={board}
          items={items}
          showPriority={showPriority}
          openItem={openItem}
          rowMenu={rowMenu}
          sort={sort}
          onSortChange={setSort}
        />
        {rowMenu.contextMenu}
      </>
    );
  }
  return (
    <>
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
          />
        </Fragment>
      ))}
      {rowMenu.contextMenu}
    </>
  );
}

import { Fragment, useState } from 'react';
import {
  ButtonIcon,
  Cell,
  Column,
  MenuTrigger,
  Row,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import {
  BoardItem,
  BoardWithContext,
} from '@internal/plugin-boards-common';
import {
  GroupByMode,
  groupItems,
  ItemSortDescriptor,
  sortItems,
} from './grouping';
import { GroupLabel } from './GroupLabel';
import { ContextMenuState, ItemContextMenu, ItemMenu } from './ItemMenu';
import type { BoardActions } from './KanbanView';
import { formatDate, RefDisplay } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { StatusBadge } from './StatusBadge';

function ItemsTable(props: {
  board: BoardWithContext;
  items: BoardItem[];
  canWrite: boolean;
  actions: BoardActions;
  assigneePool: string[];
  openItem: (itemId: string) => void;
  onItemContextMenu: (item: BoardItem, event: React.MouseEvent) => void;
  sort: ItemSortDescriptor | undefined;
  onSortChange: (descriptor: ItemSortDescriptor) => void;
}) {
  const { board, items, canWrite, actions, openItem, sort, onSortChange } =
    props;
  const columnOf = (columnId: string) =>
    board.columns.find(column => column.id === columnId);
  const sorted = sortItems(items, sort, board.columns);
  return (
    <TableRoot
      aria-label="Board items"
      onRowAction={key => openItem(String(key))}
      sortDescriptor={sort}
      onSortChange={descriptor =>
        onSortChange(descriptor as ItemSortDescriptor)
      }
    >
      <TableHeader>
        <Column id="title" isRowHeader allowsSorting>
          Title
        </Column>
        <Column id="status" allowsSorting>
          Status
        </Column>
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
              props.onItemContextMenu(item, event)
            }
          >
            <Cell>
              {item.title}
              {item.externalManager ? ` (via ${item.externalManager})` : ''}
            </Cell>
            <Cell>
              <StatusBadge column={columnOf(item.columnId)} />
            </Cell>
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
            <Cell>
              <MenuTrigger>
                <ButtonIcon
                  aria-label={`Actions for ${item.title}`}
                  variant="tertiary"
                  size="small"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                    </svg>
                  }
                />
                <ItemMenu
                  item={item}
                  columns={board.columns}
                  readonly={!canWrite || !!item.externalManager}
                  actions={actions}
                  assigneePool={props.assigneePool}
                />
              </MenuTrigger>
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
  const assigneePool = [...new Set(items.flatMap(item => item.assignees))];
  const [sort, setSort] = useState<ItemSortDescriptor | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<
    ContextMenuState | undefined
  >();
  const onItemContextMenu = (item: BoardItem, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ item, x: event.clientX, y: event.clientY });
  };
  const contextMenuElement = (
    <ItemContextMenu
      state={contextMenu}
      onClose={() => setContextMenu(undefined)}
      columns={board.columns}
      readonly={!canWrite || !!contextMenu?.item.externalManager}
      actions={actions}
      assigneePool={assigneePool}
    />
  );
  if (groupBy === 'none') {
    return (
      <>
        <ItemsTable
          board={board}
          items={items}
          canWrite={canWrite}
          actions={actions}
          assigneePool={assigneePool}
          openItem={openItem}
          onItemContextMenu={onItemContextMenu}
          sort={sort}
          onSortChange={setSort}
        />
        {contextMenuElement}
      </>
    );
  }
  return (
    <>
      {groupItems(items, groupBy).map(group => (
        <Fragment key={group.key}>
          <Text variant="body-medium" weight="bold" as="h3">
            <GroupLabel mode={groupBy} groupKey={group.key} />
          </Text>
          <ItemsTable
            board={board}
            items={group.items}
            canWrite={canWrite}
            actions={actions}
            assigneePool={assigneePool}
            openItem={openItem}
            onItemContextMenu={onItemContextMenu}
            sort={sort}
            onSortChange={setSort}
          />
        </Fragment>
      ))}
      {contextMenuElement}
    </>
  );
}

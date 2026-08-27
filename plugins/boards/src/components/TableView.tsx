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
import {
  BoardItem,
  BoardWithContext,
} from '@internal/plugin-boards-common';
import {
  groupByAssignee,
  ItemSortDescriptor,
  sortItems,
  UNASSIGNED,
} from './grouping';
import { formatDate, RefDisplay } from './common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { DueDateBadge } from './DueDate';
import { StatusBadge } from './StatusBadge';

function ItemsTable(props: {
  board: BoardWithContext;
  items: BoardItem[];
  openItem: (itemId: string) => void;
  sort: ItemSortDescriptor | undefined;
  onSortChange: (descriptor: ItemSortDescriptor) => void;
}) {
  const { board, items, openItem, sort, onSortChange } = props;
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
        <Column>Labels</Column>
        <Column>Tags</Column>
        <Column id="createdBy" allowsSorting>
          Created by
        </Column>
        <Column id="updatedAt" allowsSorting>
          Updated
        </Column>
      </TableHeader>
      <TableBody>
        {sorted.map(item => (
          <Row key={item.id} id={item.id}>
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
            <Cell>
              {Object.entries(item.labels)
                .map(([key, value]) => `${key}=${value}`)
                .join(', ')}
            </Cell>
            <Cell>{item.tags.join(', ')}</Cell>
            <Cell>
              <RefDisplay refString={item.createdBy} />
            </Cell>
            <Cell>{formatDate(item.updatedAt)}</Cell>
          </Row>
        ))}
      </TableBody>
    </TableRoot>
  );
}

export function TableView(props: {
  board: BoardWithContext;
  items: BoardItem[];
  groupBy: boolean;
  openItem: (itemId: string) => void;
}) {
  const { board, items, groupBy, openItem } = props;
  const [sort, setSort] = useState<ItemSortDescriptor | undefined>(undefined);
  if (!groupBy) {
    return (
      <ItemsTable
        board={board}
        items={items}
        openItem={openItem}
        sort={sort}
        onSortChange={setSort}
      />
    );
  }
  return (
    <>
      {groupByAssignee(items).map(group => (
        <Fragment key={group.key}>
          <Text variant="body-medium" weight="bold" as="h3">
            {group.key === UNASSIGNED ? (
              'Unassigned'
            ) : (
              <RefDisplay refString={group.key} />
            )}
          </Text>
          <ItemsTable
            board={board}
            items={group.items}
            openItem={openItem}
            sort={sort}
            onSortChange={setSort}
          />
        </Fragment>
      ))}
    </>
  );
}

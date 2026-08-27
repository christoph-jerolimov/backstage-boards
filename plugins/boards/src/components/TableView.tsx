import { Fragment } from 'react';
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
import { groupByAssignee, UNASSIGNED } from './grouping';
import { formatDate, RefChips, RefDisplay } from './common';

function ItemsTable(props: {
  board: BoardWithContext;
  items: BoardItem[];
  openItem: (itemId: string) => void;
}) {
  const { board, items, openItem } = props;
  const columnTitle = (columnId: string) =>
    board.columns.find(column => column.id === columnId)?.title ?? '?';
  return (
    <TableRoot
      aria-label="Board items"
      onRowAction={key => openItem(String(key))}
    >
      <TableHeader>
        <Column isRowHeader>Title</Column>
        <Column>Status</Column>
        <Column>Assignees</Column>
        <Column>Labels</Column>
        <Column>Tags</Column>
        <Column>Created by</Column>
        <Column>Updated</Column>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <Row key={item.id} id={item.id}>
            <Cell>
              {item.title}
              {item.externalManager ? ` (via ${item.externalManager})` : ''}
            </Cell>
            <Cell>{columnTitle(item.columnId)}</Cell>
            <Cell>
              <RefChips refs={item.assignees} />
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
  if (!groupBy) {
    return <ItemsTable board={board} items={items} openItem={openItem} />;
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
          <ItemsTable board={board} items={group.items} openItem={openItem} />
        </Fragment>
      ))}
    </>
  );
}

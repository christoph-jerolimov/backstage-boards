import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  BreadcrumbEntry,
  useApi,
  useRouteRef,
} from '@backstage/frontend-plugin-api';
import {
  Badge,
  Button,
  Cell,
  Column,
  Flex,
  MenuItem,
  Row,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import { RiArrowRightLine } from '@remixicon/react';
import {
  BoardItem,
  levelIncludes,
  MyBoardItem,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import {
  invalidateBoard,
  invalidateMyItems,
  useBoardQuery,
  useBoardsSignal,
  useMyItemsQuery,
} from '../queries';
import { rootRouteRef } from '../routes';
import { DueDateBadge } from './DueDate';
import { ItemActions, ItemMenu } from './ItemMenu';
import { useRowMenu } from './RowMenu';
import { AsyncList, ErrorText } from './common';
import { StatusBadge } from './StatusBadge';
import { useAsyncAction } from './useAsyncAction';

interface BoardGroup {
  boardId: string;
  boardName: string;
  entries: MyBoardItem[];
}

function groupByBoard(entries: MyBoardItem[]): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();
  for (const entry of entries) {
    let group = groups.get(entry.boardId);
    if (!group) {
      group = {
        boardId: entry.boardId,
        boardName: entry.boardName,
        entries: [],
      };
      groups.set(entry.boardId, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

function BoardGroupTable(props: {
  group: BoardGroup;
  basePath: string;
  onError: (message?: string) => void;
}) {
  const { group, basePath, onError } = props;
  const navigate = useNavigate();
  const boardsApi = useApi(boardsApiRef);
  const queryClient = useQueryClient();
  // the board carries the columns and the access level the item menu
  // needs; it is cached and shared with the board page
  const { data: board } = useBoardQuery(group.boardId);
  const { run } = useAsyncAction();

  const boardPath = `${basePath}/${group.boardId}`;
  const openBoard = () => navigate(boardPath);
  const columnOf = (columnId: string) =>
    board?.columns.find(column => column.id === columnId);
  const canWrite =
    !!board && levelIncludes(board.access, 'write') && !board.archivedAt;
  // only the user's own items are listed, so the quick-assign shortcuts
  // are whoever shares them; the drawer offers the full picker
  const assigneePool = [
    ...new Set(group.entries.flatMap(entry => entry.item.assignees)),
  ];

  const guarded = async (action: () => Promise<unknown>) => {
    onError(await run(action));
    // resync either way: on failure the listing may still be stale
    await invalidateBoard(queryClient, group.boardId);
    await invalidateMyItems(queryClient);
  };

  const actions: ItemActions = {
    openItem: itemId => navigate(`${boardPath}?item=${itemId}`),
    moveItem: (itemId, target) =>
      guarded(() => boardsApi.moveItem(group.boardId, itemId, target)),
    setItemDueDate: (itemId, dueDate) =>
      guarded(() => boardsApi.updateItem(group.boardId, itemId, { dueDate })),
    setAssignees: (itemId, assignees) =>
      guarded(() => boardsApi.updateItem(group.boardId, itemId, { assignees })),
    deleteItem: itemId =>
      guarded(() => boardsApi.deleteItem(group.boardId, itemId)),
  };

  const openBoardItem = (
    <MenuItem iconStart={<RiArrowRightLine size={16} />} onAction={openBoard}>
      Open board
    </MenuItem>
  );

  const rowMenu = useRowMenu<BoardItem>({
    name: item => item.title,
    children: item => (
      <ItemMenu
        item={item}
        columns={board?.columns ?? []}
        readonly={!canWrite || !!item.externalManager}
        actions={actions}
        assigneePool={assigneePool}
        extraItems={openBoardItem}
      />
    ),
  });

  return (
    <div>
      <Button
        variant="tertiary"
        onPress={openBoard}
        aria-label={`Open board ${group.boardName}`}
      >
        <Text variant="body-large" weight="bold">
          {group.boardName}
        </Text>
      </Button>
      <TableRoot
        aria-label={`My items on ${group.boardName}`}
        onRowAction={key => actions.openItem(String(key))}
      >
        <TableHeader>
          <Column isRowHeader>Item</Column>
          <Column>Status</Column>
          <Column>Due</Column>
          <Column>Tags</Column>
          <Column>Actions</Column>
        </TableHeader>
        <TableBody>
          {group.entries.map(entry => (
            <Row
              key={entry.item.id}
              id={entry.item.id}
              onContextMenu={(event: React.MouseEvent) =>
                rowMenu.onContextMenu(entry.item, event)
              }
            >
              <Cell>{entry.item.title}</Cell>
              <Cell>
                {columnOf(entry.item.columnId) ? (
                  <StatusBadge column={columnOf(entry.item.columnId)} />
                ) : (
                  // until the board resolves, the listing's own title
                  <Badge size="small">{entry.columnTitle}</Badge>
                )}
              </Cell>
              <Cell>
                <DueDateBadge dueDate={entry.item.dueDate} />
              </Cell>
              <Cell>{entry.item.tags.join(', ')}</Cell>
              <Cell>{rowMenu.rowActions(entry.item)}</Cell>
            </Row>
          ))}
        </TableBody>
      </TableRoot>
      {rowMenu.contextMenu}
    </div>
  );
}

/** The current user's items grouped by board; reused by the Boards tab. */
export function MyItemsList() {
  const rootLink = useRouteRef(rootRouteRef);
  const basePath = rootLink?.() ?? '/boards';
  const [actionError, setActionError] = useState<string | undefined>();

  const { data: entries, isLoading, error, refetch } = useMyItemsQuery();

  useBoardsSignal(refetch);

  const groups = useMemo(() => groupByBoard(entries ?? []), [entries]);

  return (
    <Flex direction="column" gap="4">
      {actionError && <ErrorText>{actionError}</ErrorText>}
      <AsyncList
        isLoading={isLoading}
        error={error}
        items={groups}
        loading={<Text>Loading your items…</Text>}
        renderError={message => (
          <ErrorText>My items could not be loaded: {message}</ErrorText>
        )}
        empty={
          <Text color="secondary">
            Nothing is assigned to you on any board.
          </Text>
        }
      >
        {boards =>
          boards.map(group => (
            <BoardGroupTable
              key={group.boardId}
              group={group}
              basePath={basePath}
              onError={setActionError}
            />
          ))
        }
      </AsyncList>
    </Flex>
  );
}

export function MyItemsPage() {
  const rootLink = useRouteRef(rootRouteRef);
  const basePath = rootLink?.() ?? '/boards';
  return (
    <BreadcrumbEntry
      entry={{ href: `${basePath}/my-items`, label: 'My items' }}
    >
      <Flex direction="column" gap="4" style={{ padding: 16 }}>
        <Text variant="title-medium" as="h1">
          My items
        </Text>
        <MyItemsList />
      </Flex>
    </BreadcrumbEntry>
  );
}

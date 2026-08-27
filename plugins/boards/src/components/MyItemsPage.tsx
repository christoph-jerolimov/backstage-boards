import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BreadcrumbEntry,
  useApi,
  useRouteRef,
} from '@backstage/frontend-plugin-api';
import { useSignal } from '@backstage/plugin-signals-react';
import {
  Badge,
  Button,
  Cell,
  Column,
  Flex,
  Menu,
  MenuItem,
  Row,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import { RiArrowRightLine, RiFileList2Line } from '@remixicon/react';
import { MyBoardItem } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { DueDateBadge } from './DueDate';
import { RowActionsMenu, RowContextMenu, useRowContextMenu } from './RowMenu';

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

/** The shared my-items actions menu: row button and right-click alike. */
function MyItemMenu(props: {
  entry: MyBoardItem;
  onOpenItem: (entry: MyBoardItem) => void;
  onOpenBoard: (entry: MyBoardItem) => void;
}) {
  const { entry, onOpenItem, onOpenBoard } = props;
  return (
    <Menu aria-label={`Actions for ${entry.item.title}`}>
      <MenuItem
        iconStart={<RiFileList2Line size={16} />}
        onAction={() => onOpenItem(entry)}
      >
        Open item
      </MenuItem>
      <MenuItem
        iconStart={<RiArrowRightLine size={16} />}
        onAction={() => onOpenBoard(entry)}
      >
        Open board
      </MenuItem>
    </Menu>
  );
}

function BoardGroupTable(props: { group: BoardGroup; basePath: string }) {
  const { group, basePath } = props;
  const navigate = useNavigate();
  const contextMenu = useRowContextMenu<MyBoardItem>();
  const openItem = (entry: MyBoardItem) =>
    navigate(`${basePath}/${entry.boardId}?item=${entry.item.id}`);
  const openBoard = (entry: MyBoardItem) =>
    navigate(`${basePath}/${entry.boardId}`);
  const byId = new Map(group.entries.map(entry => [entry.item.id, entry]));
  return (
    <div>
      <Button
        variant="tertiary"
        onPress={() => navigate(`${basePath}/${group.boardId}`)}
        aria-label={`Open board ${group.boardName}`}
      >
        <Text variant="body-large" weight="bold">
          {group.boardName}
        </Text>
      </Button>
      <TableRoot
        aria-label={`My items on ${group.boardName}`}
        onRowAction={key => {
          const entry = byId.get(String(key));
          if (entry) {
            openItem(entry);
          }
        }}
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
                contextMenu.open(entry, event)
              }
            >
              <Cell>{entry.item.title}</Cell>
              <Cell>
                <Badge size="small">{entry.columnTitle}</Badge>
              </Cell>
              <Cell>
                <DueDateBadge dueDate={entry.item.dueDate} />
              </Cell>
              <Cell>{entry.item.tags.join(', ')}</Cell>
              <Cell>
                <RowActionsMenu label={`Actions for ${entry.item.title}`}>
                  <MyItemMenu
                    entry={entry}
                    onOpenItem={openItem}
                    onOpenBoard={openBoard}
                  />
                </RowActionsMenu>
              </Cell>
            </Row>
          ))}
        </TableBody>
      </TableRoot>
      <RowContextMenu
        state={contextMenu.state}
        onClose={contextMenu.close}
        label={entry => `Context menu for ${entry.item.title}`}
      >
        {entry => (
          <MyItemMenu
            entry={entry}
            onOpenItem={openItem}
            onOpenBoard={openBoard}
          />
        )}
      </RowContextMenu>
    </div>
  );
}

/** The current user's items grouped by board; reused by the Boards tab. */
export function MyItemsList() {
  const boardsApi = useApi(boardsApiRef);
  const rootLink = useRouteRef(rootRouteRef);
  const basePath = rootLink?.() ?? '/boards';

  const {
    data: entries,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['boards', 'my-items'],
    queryFn: () => boardsApi.listMyItems(),
  });

  const { lastSignal } = useSignal('boards');
  useEffect(() => {
    if (lastSignal) {
      refetch();
    }
  }, [lastSignal, refetch]);

  const groups = useMemo(() => groupByBoard(entries ?? []), [entries]);

  return (
    <Flex direction="column" gap="4">
      {error && (
        <Text style={{ color: 'var(--bui-fg-negative)' }}>
          My items could not be loaded: {(error as Error).message}
        </Text>
      )}
      {isLoading && <Text>Loading your items…</Text>}
      {!isLoading && !error && groups.length === 0 && (
        <Text color="secondary">Nothing is assigned to you on any board.</Text>
      )}
      {groups.map(group => (
        <BoardGroupTable
          key={group.boardId}
          group={group}
          basePath={basePath}
        />
      ))}
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

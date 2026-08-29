import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BreadcrumbEntry, useApi } from '@backstage/frontend-plugin-api';
import {
  Badge,
  Button,
  Cell,
  Column,
  Flex,
  MenuItem,
  Row,
  Select,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import { RiArrowRightLine } from '@remixicon/react';
import {
  BoardWithContext,
  itemMatchesFilter,
  levelIncludes,
  MyBoardItem,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import {
  invalidateBoard,
  invalidateMyItems,
  useBoardsQueries,
  useBoardsSignal,
  useMyItemsQuery,
} from '../queries';
import { useBoardsBasePath } from '../routes';
import { DueDateBadge } from './DueDate';
import {
  assigneePool,
  groupMyItems,
  MyItemGroup,
  MyItemsGroupBy,
  MY_ITEMS_PAGE_GROUP_BY,
} from './grouping';
import { GroupLabel } from './GroupLabel';
import { ItemDrawerHost } from './ItemDrawerHost';
import { ItemActions, ItemMenu } from './ItemMenu';
import { useRowMenu } from './RowMenu';
import { AsyncList, ErrorText, selectedOption } from './common';
import { ItemFilterBar, useItemFilter } from './ItemFilterBar';
import { PriorityChip, StatusBadge } from './StatusBadge';
import { useAsyncAction } from './useAsyncAction';

/** How the my-items group-by menu reads, in {@link MY_ITEMS_PAGE_GROUP_BY} order. */
const GROUP_BY_LABELS: Record<(typeof MY_ITEMS_PAGE_GROUP_BY)[number], string> =
  {
    board: 'By board',
    none: 'Not grouped',
    dueDate: 'By due date',
    tags: 'By tags',
  };

/**
 * One group's table. Every row resolves its own board, because a group
 * that is not a board (a tag, a due date, all items) mixes them — and
 * the status color, the write access and the actions all belong to the
 * item's own board.
 */
function MyItemsTable(props: {
  label: string;
  entries: MyBoardItem[];
  boards: Map<string, BoardWithContext>;
  pool: string[];
  basePath: string;
  showBoardColumn: boolean;
  /** Render the priority column; on when any listed item has one. */
  showPriority: boolean;
  onError: (message?: string) => void;
  /** Opens the entry's detail drawer in place. */
  onOpenItem: (entry: MyBoardItem) => void;
}) {
  const {
    label,
    entries,
    boards,
    pool,
    basePath,
    showBoardColumn,
    showPriority,
    onError,
    onOpenItem,
  } = props;
  const navigate = useNavigate();
  const boardsApi = useApi(boardsApiRef);
  const queryClient = useQueryClient();
  const { run } = useAsyncAction();

  const byId = new Map(entries.map(entry => [entry.item.id, entry]));
  const boardPath = (boardId: string) => `${basePath}/${boardId}`;
  const columnOf = (entry: MyBoardItem) =>
    boards
      .get(entry.boardId)
      ?.columns.find(column => column.id === entry.item.columnId);
  const canWrite = (entry: MyBoardItem) => {
    const board = boards.get(entry.boardId);
    return !!board && levelIncludes(board.access, 'write') && !board.archivedAt;
  };

  const guarded = async (boardId: string, action: () => Promise<unknown>) => {
    onError(await run(action));
    // resync either way: on failure the listing may still be stale
    await invalidateBoard(queryClient, boardId);
    await invalidateMyItems(queryClient);
  };

  const actionsOf = (boardId: string): ItemActions => ({
    openItem: itemId => {
      const entry = byId.get(itemId);
      if (entry) {
        onOpenItem(entry);
      }
    },
    moveItem: (itemId, target) =>
      guarded(boardId, () => boardsApi.moveItem(boardId, itemId, target)),
    setItemDueDate: (itemId, dueDate) =>
      guarded(boardId, () =>
        boardsApi.updateItem(boardId, itemId, { dueDate }),
      ),
    setAssignees: (itemId, assignees) =>
      guarded(boardId, () =>
        boardsApi.updateItem(boardId, itemId, { assignees }),
      ),
    setItemPriority: (itemId, priorityId) =>
      guarded(boardId, () =>
        boardsApi.updateItem(boardId, itemId, { priorityId }),
      ),
    deleteItem: itemId =>
      guarded(boardId, () => boardsApi.deleteItem(boardId, itemId)),
  });

  const rowMenu = useRowMenu<MyBoardItem>({
    name: entry => entry.item.title,
    children: entry => (
      <ItemMenu
        item={entry.item}
        columns={boards.get(entry.boardId)?.columns ?? []}
        priorities={boards.get(entry.boardId)?.priorities ?? []}
        readonly={!canWrite(entry) || !!entry.item.externalManager}
        actions={actionsOf(entry.boardId)}
        assigneePool={pool}
        extraItems={
          <MenuItem
            iconStart={<RiArrowRightLine size={16} />}
            onAction={() => navigate(boardPath(entry.boardId))}
          >
            Open board
          </MenuItem>
        }
      />
    ),
  });

  return (
    <>
      <TableRoot
        aria-label={label}
        onRowAction={key => {
          const entry = byId.get(String(key));
          if (entry) {
            onOpenItem(entry);
          }
        }}
      >
        <TableHeader>
          {showBoardColumn ? <Column>Board</Column> : null}
          <Column isRowHeader>Item</Column>
          <Column>Status</Column>
          {showPriority ? <Column>Priority</Column> : null}
          <Column>Due</Column>
          <Column>Tags</Column>
          <Column>Actions</Column>
        </TableHeader>
        <TableBody>
          {entries.map(entry => (
            <Row
              key={entry.item.id}
              id={entry.item.id}
              onContextMenu={(event: React.MouseEvent) =>
                rowMenu.onContextMenu(entry, event)
              }
            >
              {showBoardColumn ? (
                <Cell>
                  <Button
                    variant="tertiary"
                    size="small"
                    onPress={() => navigate(boardPath(entry.boardId))}
                    aria-label={`Open board ${entry.boardName}`}
                  >
                    <Text variant="body-small">{entry.boardName}</Text>
                  </Button>
                </Cell>
              ) : null}
              <Cell>{entry.item.title}</Cell>
              <Cell>
                {columnOf(entry) ? (
                  <StatusBadge column={columnOf(entry)} />
                ) : (
                  // until the board resolves, the listing's own title
                  <Badge size="small">{entry.columnTitle}</Badge>
                )}
              </Cell>
              {showPriority ? (
                <Cell>
                  <PriorityChip priority={entry.priority} />
                </Cell>
              ) : null}
              <Cell>
                <DueDateBadge dueDate={entry.item.dueDate} />
              </Cell>
              <Cell>{entry.item.tags.join(', ')}</Cell>
              <Cell>{rowMenu.rowActions(entry)}</Cell>
            </Row>
          ))}
        </TableBody>
      </TableRoot>
      {rowMenu.contextMenu}
    </>
  );
}

/** A group's heading: the board as a link, or the group's own label. */
function GroupHeading(props: {
  group: MyItemGroup;
  groupBy: MyItemsGroupBy;
  onOpenBoard: (boardId: string) => void;
}) {
  const { group, groupBy, onOpenBoard } = props;
  if (groupBy === 'none') {
    return null;
  }
  const count = (
    <Text variant="body-small" color="secondary">
      {group.entries.length}
    </Text>
  );
  if (groupBy === 'board') {
    return (
      <Flex align="center" gap="2">
        <Button
          variant="tertiary"
          onPress={() => onOpenBoard(group.key)}
          aria-label={`Open board ${group.label}`}
        >
          <Text variant="body-large" weight="bold">
            {group.label}
          </Text>
        </Button>
        {count}
      </Flex>
    );
  }
  return (
    <Flex align="center" gap="2">
      <Text variant="body-large" weight="bold">
        {groupBy === 'status' ? (
          group.label
        ) : (
          // due dates and tags read the way they do on a board
          <GroupLabel mode={groupBy} groupKey={group.key} />
        )}
      </Text>
      {count}
    </Flex>
  );
}

/** How a group's table is announced. */
function tableLabel(group: MyItemGroup, groupBy: MyItemsGroupBy): string {
  if (groupBy === 'none') {
    return 'My items';
  }
  if (groupBy === 'board') {
    return `My items on ${group.label}`;
  }
  return `My items grouped under ${group.label}`;
}

/** The current user's items, filtered and grouped; reused by the Boards tab. */
export function MyItemsList() {
  const navigate = useNavigate();
  const basePath = useBoardsBasePath();
  const [actionError, setActionError] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<MyItemsGroupBy>('board');
  // the open drawer, held as its own copy so it survives the row
  // disappearing (e.g. after the user unassigns themselves)
  const [openEntry, setOpenEntry] = useState<MyBoardItem | undefined>();

  const { data: entries, isLoading, error, refetch } = useMyItemsQuery();

  useBoardsSignal(refetch);

  const items = useMemo(
    () => (entries ?? []).map(entry => entry.item),
    [entries],
  );
  const filter = useItemFilter(items);
  const filtered = useMemo(
    () =>
      (entries ?? []).filter(entry =>
        itemMatchesFilter(entry.item, filter.filter),
      ),
    [entries, filter.filter],
  );
  // every board behind the listing, so a row can resolve its own even
  // when the grouping mixes them
  const boards = useBoardsQueries(
    useMemo(() => (entries ?? []).map(entry => entry.boardId), [entries]),
  );
  const pool = useMemo(() => assigneePool(items), [items]);
  const groups = useMemo(
    () => groupMyItems(filtered, groupBy),
    [filtered, groupBy],
  );
  // one decision for the whole listing, so every group shows the same columns
  const showPriority = filtered.some(entry => entry.priority);

  return (
    <Flex direction="column" gap="4">
      {actionError && <ErrorText>{actionError}</ErrorText>}
      {(entries ?? []).length > 0 && (
        <Flex
          align="center"
          gap="2"
          justify="between"
          style={{ flexWrap: 'wrap' }}
        >
          {/* every listed item is already the viewer's, so a single
              assignee would match every row */}
          <ItemFilterBar filter={filter} minAssigneeOptions={2} />
          {/* the select grows into whatever the flex row leaves it */}
          <div style={{ width: 160, flexShrink: 0 }}>
            <Select
              aria-label="Group by"
              size="small"
              options={MY_ITEMS_PAGE_GROUP_BY.map(mode => ({
                value: mode,
                label: GROUP_BY_LABELS[mode],
              }))}
              selectedKey={groupBy}
              onSelectionChange={key =>
                setGroupBy(
                  selectedOption(key, MY_ITEMS_PAGE_GROUP_BY) ?? 'board',
                )
              }
            />
          </div>
        </Flex>
      )}
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
            {filter.active
              ? 'No items match your filters.'
              : 'Nothing is assigned to you on any board.'}
          </Text>
        }
      >
        {rendered =>
          rendered.map(group => (
            <div key={group.key}>
              <GroupHeading
                group={group}
                groupBy={groupBy}
                onOpenBoard={boardId => navigate(`${basePath}/${boardId}`)}
              />
              <MyItemsTable
                label={tableLabel(group, groupBy)}
                entries={group.entries}
                boards={boards}
                pool={pool}
                basePath={basePath}
                showBoardColumn={groupBy !== 'board'}
                showPriority={showPriority}
                onError={setActionError}
                onOpenItem={setOpenEntry}
              />
            </div>
          ))
        }
      </AsyncList>
      {openEntry && (
        <ItemDrawerHost
          boardId={openEntry.boardId}
          itemId={openEntry.item.id}
          fallbackItem={openEntry.item}
          onClose={() => setOpenEntry(undefined)}
        />
      )}
    </Flex>
  );
}

export function MyItemsPage() {
  const basePath = useBoardsBasePath();
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

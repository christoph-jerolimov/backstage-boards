import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BreadcrumbEntry } from '@backstage/frontend-plugin-api';
import { Button, Flex, Text } from '@backstage/ui';
import { RiQuestionLine, RiErrorWarningLine } from '@remixicon/react';
import {
  errorMessage,
  levelIncludes,
  wipState,
} from '@internal/plugin-boards-common';
import { BoardsRequestError } from '../api';
import { useBoardsBasePath } from '../routes';
import {
  invalidateBoard,
  queryKeys,
  useBoardQuery,
  useBoardsSignal,
  useItemsQuery,
} from '../queries';
import { useQueryClient } from '@tanstack/react-query';
import { BoardView } from './BoardView';
import { TableView } from './TableView';
import { ItemDrawer } from './ItemDrawer';
import {
  ALL_BOARD_VIEW_MODES,
  ArchivedBoardAlert,
  BoardHeader,
  BoardViewMode,
} from './BoardHeader';
import { BoardDialogKind, BoardDialogs } from './BoardDialogs';
import { ItemFilterBar, useItemFilter } from './ItemFilterBar';
import { BulkActionsBar } from './BulkActionsBar';
import { BoardDescription } from './BoardDescription';
import { InsightsView } from './InsightsView';
import { ErrorText } from './common';
import { EmptyState } from './EmptyState';
import { useBoardActions, useOpenItemParam } from './useBoardActions';
import { useItemSelection } from './useItemSelection';
import {
  ALL_GROUP_BY_MODES,
  assigneePool,
  GroupByMode,
  groupItems,
  ITEM_SORT_COLUMNS,
  ItemSortDescriptor,
  sortItems,
} from './grouping';

export function BoardPage() {
  const { boardId = '' } = useParams();
  return <BoardPageContent boardId={boardId} />;
}

/**
 * The complete board experience. With `embedded` (e.g. inside the
 * catalog entity tab) the breadcrumb wrapper is skipped and archiving
 * stays in place instead of navigating away.
 */
/**
 * The board page's view state — view mode, grouping, table sort — kept
 * in the URL (`view`, `group`, `sort`), so a board view is shareable
 * as a link. Defaults are omitted, invalid values ignored, and writes
 * replace the history entry.
 */
function useBoardViewParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const write = (mutate: (params: URLSearchParams) => void) =>
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        mutate(next);
        return next;
      },
      { replace: true },
    );

  const view =
    ALL_BOARD_VIEW_MODES.find(mode => mode === searchParams.get('view')) ??
    'board';
  const groupBy =
    ALL_GROUP_BY_MODES.find(mode => mode === searchParams.get('group')) ??
    'none';
  const rawSort = searchParams.get('sort') ?? '';
  const sortColumn = ITEM_SORT_COLUMNS.find(
    column => column === rawSort.replace(/^-/, ''),
  );
  const tableSort: ItemSortDescriptor | undefined = sortColumn
    ? {
        column: sortColumn,
        direction: rawSort.startsWith('-') ? 'descending' : 'ascending',
      }
    : undefined;

  return {
    view,
    setView: (next: BoardViewMode) =>
      write(params => {
        if (next === 'board') {
          params.delete('view');
        } else {
          params.set('view', next);
        }
      }),
    groupBy,
    setGroupBy: (next: GroupByMode) =>
      write(params => {
        if (next === 'none') {
          params.delete('group');
        } else {
          params.set('group', next);
        }
      }),
    tableSort,
    setTableSort: (next: ItemSortDescriptor | undefined) =>
      write(params => {
        if (!next) {
          params.delete('sort');
        } else {
          params.set(
            'sort',
            `${next.direction === 'descending' ? '-' : ''}${next.column}`,
          );
        }
      }),
  };
}

export function BoardPageContent(props: {
  boardId: string;
  embedded?: boolean;
}) {
  const { boardId, embedded } = props;
  const navigate = useNavigate();
  const basePath = useBoardsBasePath();
  const queryClient = useQueryClient();
  const { view, setView, groupBy, setGroupBy, tableSort, setTableSort } =
    useBoardViewParams();
  const [dialog, setDialog] = useState<BoardDialogKind | undefined>();

  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = useBoardQuery(boardId);
  const { data: items } = useItemsQuery(boardId);

  const { openItemId, openItem, closeItem } = useOpenItemParam();
  const { actions, bulk, guarded, refreshAll, error } = useBoardActions(
    boardId,
    openItem,
  );
  const filter = useItemFilter(items ?? [], board?.priorities, {
    inUrl: true,
  });
  // columns whose unfiltered item count reached the hard WIP limit:
  // move/status entries into them disable across the page's surfaces
  const fullColumnIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items ?? []) {
      counts.set(item.columnId, (counts.get(item.columnId) ?? 0) + 1);
    }
    return new Set(
      (board?.columns ?? [])
        .filter(
          column => wipState(column, counts.get(column.id) ?? 0) === 'hard',
        )
        .map(column => column.id),
    );
  }, [board?.columns, items]);
  // one id-based selection shared by the board and table views, so it
  // survives switching between them
  const selection = useItemSelection();

  // the order the drawer's prev/next walks: exactly what the active
  // view shows — the kanban's lanes left to right, or the table's
  // grouped and sorted rows (the insights view keeps the board order)
  const drawerOrder = useMemo(() => {
    if (!board) {
      return [];
    }
    const visible = filter.filteredItems;
    const dedup = (list: typeof visible) => {
      const seen = new Set<string>();
      return list.filter(item => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });
    };
    if (view === 'table') {
      const groups =
        groupBy === 'none'
          ? [{ key: 'all', items: visible }]
          : groupItems(visible, groupBy, board.priorities);
      return dedup(
        groups.flatMap(group =>
          sortItems(group.items, tableSort, board.columns),
        ),
      );
    }
    return dedup(
      [...board.columns]
        .sort((a, b) => a.position - b.position)
        .flatMap(column => {
          const lane = visible
            .filter(item => item.columnId === column.id)
            .sort((a, b) => a.position - b.position);
          return groupBy === 'none'
            ? lane
            : groupItems(lane, groupBy, board.priorities).flatMap(
                group => group.items,
              );
        }),
    );
  }, [board, filter.filteredItems, view, groupBy, tableSort]);

  useBoardsSignal(() => invalidateBoard(queryClient, boardId), { boardId });

  if (boardLoading) {
    return <Text style={{ padding: 16 }}>Loading board…</Text>;
  }
  if (boardError || !board) {
    const notFound =
      boardError instanceof BoardsRequestError && boardError.status === 404;
    if (notFound || !boardError) {
      return (
        <EmptyState
          icon={<RiQuestionLine size={28} />}
          title="Board not found"
          description="The board may have been deleted, its link may be wrong, or you may not have access to it."
          actions={
            <Button onPress={() => navigate(basePath)}>Back to boards</Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<RiErrorWarningLine size={28} />}
        title="The board could not be loaded"
        description={errorMessage(boardError)}
        actions={
          <Button
            onPress={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.board(boardId),
              })
            }
          >
            Retry
          </Button>
        }
      />
    );
  }

  const archived = !!board.archivedAt;
  const canWrite = levelIncludes(board.access, 'write') && !archived;
  const isAdmin = levelIncludes(board.access, 'admin') && !archived;
  const openDrawerItem = (items ?? []).find(item => item.id === openItemId);

  const selectedItems = canWrite
    ? filter.filteredItems.filter(item => selection.selected.has(item.id))
    : [];

  const content = (
    <Flex direction="column" gap="3" style={{ padding: 16 }}>
      {archived && (
        <ArchivedBoardAlert
          board={board}
          isAdmin={levelIncludes(board.access, 'admin')}
          guarded={guarded}
          onRequestDelete={() => setDialog('delete')}
        />
      )}

      <BoardHeader
        board={board}
        canWrite={canWrite}
        isAdmin={isAdmin}
        view={view}
        onViewChange={setView}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        guarded={guarded}
        onOpenDialog={setDialog}
      />

      {(board.description || canWrite) && (
        <BoardDescription board={board} canWrite={canWrite} />
      )}

      {view !== 'insights' && <ItemFilterBar filter={filter} />}

      {error && <ErrorText>{error}</ErrorText>}

      {view !== 'insights' && selectedItems.length > 0 && (
        <BulkActionsBar
          board={board}
          selectedItems={selectedItems}
          assigneePool={assigneePool(filter.filteredItems)}
          tagPool={filter.allTags}
          bulk={bulk}
          onClear={selection.clear}
        />
      )}

      {view === 'insights' && (
        <InsightsView board={board} onOpenDialog={setDialog} />
      )}
      {view === 'board' && (
        <BoardView
          board={board}
          items={filter.filteredItems}
          allItems={items ?? []}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          selection={canWrite ? selection : undefined}
        />
      )}
      {view === 'table' && (
        <TableView
          board={board}
          items={filter.filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          openItem={actions.openItem}
          selection={canWrite ? selection : undefined}
          fullColumnIds={fullColumnIds}
          sort={tableSort}
          onSortChange={setTableSort}
        />
      )}

      {openDrawerItem && (
        <ItemDrawer
          board={board}
          item={openDrawerItem}
          canWrite={canWrite}
          fullColumnIds={fullColumnIds}
          nav={(() => {
            const index = drawerOrder.findIndex(
              entry => entry.id === openDrawerItem.id,
            );
            if (index < 0) {
              return undefined;
            }
            return {
              prevId: drawerOrder[index - 1]?.id,
              nextId: drawerOrder[index + 1]?.id,
              position: index + 1,
              total: drawerOrder.length,
              onNavigate: actions.openItem,
            };
          })()}
          tagSuggestions={filter.allTags}
          onClose={closeItem}
          onChanged={refreshAll}
        />
      )}

      <BoardDialogs
        board={board}
        items={filter.filteredItems}
        canWrite={canWrite}
        archived={archived}
        open={dialog}
        onClose={() => setDialog(undefined)}
        onChanged={refreshAll}
        onOpenItem={actions.openItem}
        onDeleted={async () => {
          if (embedded) {
            await refreshAll();
          } else {
            navigate(basePath);
          }
        }}
      />
    </Flex>
  );

  if (embedded) {
    return content;
  }
  return (
    <BreadcrumbEntry
      entry={{ href: `${basePath}/${board.id}`, label: board.name }}
    >
      {content}
    </BreadcrumbEntry>
  );
}

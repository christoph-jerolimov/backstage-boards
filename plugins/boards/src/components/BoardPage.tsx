import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BreadcrumbEntry } from '@backstage/frontend-plugin-api';
import { Flex, Text } from '@backstage/ui';
import { errorMessage, levelIncludes } from '@internal/plugin-boards-common';
import { useBoardsBasePath } from '../routes';
import {
  invalidateBoard,
  useBoardQuery,
  useBoardsSignal,
  useItemsQuery,
} from '../queries';
import { useQueryClient } from '@tanstack/react-query';
import { BoardView } from './BoardView';
import { TableView } from './TableView';
import { ItemDrawer } from './ItemDrawer';
import { ArchivedBoardAlert, BoardHeader, BoardViewMode } from './BoardHeader';
import { BoardDialogKind, BoardDialogs } from './BoardDialogs';
import { ItemFilterBar, useItemFilter } from './ItemFilterBar';
import { BulkActionsBar } from './BulkActionsBar';
import { ErrorText } from './common';
import { useBoardActions, useOpenItemParam } from './useBoardActions';
import { useItemSelection } from './useItemSelection';
import { assigneePool, GroupByMode } from './grouping';

export function BoardPage() {
  const { boardId = '' } = useParams();
  return <BoardPageContent boardId={boardId} />;
}

/**
 * The complete board experience. With `embedded` (e.g. inside the
 * catalog entity tab) the breadcrumb wrapper is skipped and archiving
 * stays in place instead of navigating away.
 */
export function BoardPageContent(props: {
  boardId: string;
  embedded?: boolean;
}) {
  const { boardId, embedded } = props;
  const navigate = useNavigate();
  const basePath = useBoardsBasePath();
  const queryClient = useQueryClient();
  const [view, setView] = useState<BoardViewMode>('board');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
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
  const filter = useItemFilter(items ?? [], board?.priorities);
  // one id-based selection shared by the board and table views, so it
  // survives switching between them
  const selection = useItemSelection();

  useBoardsSignal(() => invalidateBoard(queryClient, boardId), { boardId });

  if (boardLoading) {
    return <Text style={{ padding: 16 }}>Loading board…</Text>;
  }
  if (boardError || !board) {
    return (
      <Text style={{ padding: 16 }}>
        Board could not be loaded:{' '}
        {boardError ? errorMessage(boardError) : 'not found'}
      </Text>
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

      <ItemFilterBar filter={filter} />

      {error && <ErrorText>{error}</ErrorText>}

      {selectedItems.length > 0 && (
        <BulkActionsBar
          board={board}
          selectedItems={selectedItems}
          assigneePool={assigneePool(filter.filteredItems)}
          bulk={bulk}
          onClear={selection.clear}
        />
      )}

      {view === 'board' ? (
        <BoardView
          board={board}
          items={filter.filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          selection={canWrite ? selection : undefined}
        />
      ) : (
        <TableView
          board={board}
          items={filter.filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          openItem={actions.openItem}
          selection={canWrite ? selection : undefined}
        />
      )}

      {openDrawerItem && (
        <ItemDrawer
          board={board}
          item={openDrawerItem}
          canWrite={canWrite}
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

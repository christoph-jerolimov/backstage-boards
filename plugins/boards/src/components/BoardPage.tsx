import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BreadcrumbEntry, useRouteRef } from '@backstage/frontend-plugin-api';
import { useSignal } from '@backstage/plugin-signals-react';
import { Flex, Text } from '@backstage/ui';
import { levelIncludes } from '@internal/plugin-boards-common';
import { rootRouteRef } from '../routes';
import { invalidateBoard, useBoardQuery, useItemsQuery } from '../queries';
import { useQueryClient } from '@tanstack/react-query';
import { BoardView } from './BoardView';
import { TableView } from './TableView';
import { ItemDrawer } from './ItemDrawer';
import { ArchivedBoardAlert, BoardHeader, BoardViewMode } from './BoardHeader';
import { BoardDialogKind, BoardDialogs } from './BoardDialogs';
import { BoardFilterBar, useItemFilter } from './BoardFilterBar';
import { useBoardActions, useOpenItemParam } from './useBoardActions';
import { GroupByMode } from './grouping';

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
  const rootLink = useRouteRef(rootRouteRef);
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
  const { actions, guarded, refreshAll, error } = useBoardActions(
    boardId,
    openItem,
  );
  const filter = useItemFilter(items ?? []);

  const { lastSignal } = useSignal<{ boardId: string }>('boards');
  useEffect(() => {
    if (lastSignal?.boardId === boardId) {
      invalidateBoard(queryClient, boardId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSignal]);

  if (boardLoading) {
    return <Text style={{ padding: 16 }}>Loading board…</Text>;
  }
  if (boardError || !board) {
    return (
      <Text style={{ padding: 16 }}>
        Board could not be loaded:{' '}
        {(boardError as Error)?.message ?? 'not found'}
      </Text>
    );
  }

  const archived = !!board.archivedAt;
  const canWrite = levelIncludes(board.access, 'write') && !archived;
  const isAdmin = levelIncludes(board.access, 'admin') && !archived;
  const openDrawerItem = (items ?? []).find(item => item.id === openItemId);
  const basePath = rootLink?.() ?? '/boards';

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

      <BoardFilterBar filter={filter} />

      {error && (
        <Text variant="body-small" style={{ color: '#cc3344' }}>
          {error}
        </Text>
      )}

      {view === 'board' ? (
        <BoardView
          board={board}
          items={filter.filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
        />
      ) : (
        <TableView
          board={board}
          items={filter.filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          openItem={actions.openItem}
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

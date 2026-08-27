import { useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  BreadcrumbEntry,
  useApi,
  useRouteRef,
} from '@backstage/frontend-plugin-api';
import { useSignal } from '@backstage/plugin-signals-react';
import {
  RiArchiveLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiGridLine,
  RiHistoryLine,
  RiKanbanView,
  RiLockUnlockLine,
  RiSettings3Line,
  RiMore2Fill,
} from '@remixicon/react';
import {
  Alert,
  Button,
  ButtonIcon,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  SearchField,
  Select,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import {
  ItemFilter,
  isEmptyFilter,
  itemMatchesFilter,
  levelIncludes,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { GroupByMode } from './grouping';
import { rootRouteRef } from '../routes';
import {
  invalidateBoard,
  useBoardQuery,
  useItemsQuery,
  useMoveItem,
  useRenameItem,
} from '../queries';
import { useQueryClient } from '@tanstack/react-query';
import { InlineEdit } from './common';
import { BoardActions, KanbanView } from './KanbanView';
import { TableView } from './TableView';
import { ItemDrawer } from './ItemDrawer';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { ShareDialog } from './ShareDialog';
import { RecentChangesDialog } from './RecentChangesDialog';
import { ArchivedItemsDialog } from './ArchivedItemsDialog';
import { DuplicateBoardDialog } from './DuplicateBoardDialog';
import { WatchButton } from './WatchButton';

function StarIcon(props: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill={props.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

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
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const rootLink = useRouteRef(rootRouteRef);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [filterText, setFilterText] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const queryClient = useQueryClient();
  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = useBoardQuery(boardId);
  const { data: items } = useItemsQuery(boardId);

  const refreshAll = async () => {
    setError(undefined);
    await invalidateBoard(queryClient, boardId);
  };

  const { lastSignal } = useSignal<{ boardId: string }>('boards');
  useEffect(() => {
    if (lastSignal?.boardId === boardId) {
      invalidateBoard(queryClient, boardId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSignal]);

  const guarded = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refreshAll();
    } catch (err) {
      // refresh directly: refreshAll() would clear the error again
      await invalidateBoard(queryClient, boardId);
      setError((err as Error).message);
    }
  };

  const moveItemMutation = useMoveItem(boardId, setError);
  const renameItemMutation = useRenameItem(boardId, setError);

  const actions: BoardActions = useMemo(
    () => ({
      // optimistic: cache updates immediately, server reconciles
      moveItem: async (itemId, target) => {
        setError(undefined);
        await moveItemMutation.mutateAsync({ itemId, ...target }).catch(() => {
          // error already surfaced via the mutation's onError
        });
      },
      renameItem: async (itemId, title) => {
        setError(undefined);
        await renameItemMutation.mutateAsync({ itemId, title }).catch(() => {
          // error already surfaced via the mutation's onError
        });
      },
      createItem: (columnId, title) =>
        guarded(() => boardsApi.createItem(boardId, { columnId, title })),
      renameColumn: (columnId, title) =>
        guarded(() => boardsApi.updateColumn(boardId, columnId, { title })),
      reorderColumn: (columnId, position) =>
        guarded(() => boardsApi.updateColumn(boardId, columnId, { position })),
      addColumn: title => guarded(() => boardsApi.addColumn(boardId, { title })),
      setColumnColor: (columnId, color) =>
        guarded(() => boardsApi.updateColumn(boardId, columnId, { color })),
      deleteColumn: (columnId, moveItemsTo) =>
        guarded(() =>
          boardsApi.deleteColumn(boardId, columnId, { moveItemsTo }),
        ),
      setItemDueDate: (itemId, dueDate) =>
        guarded(() => boardsApi.updateItem(boardId, itemId, { dueDate })),
      setAssignees: (itemId, assignees) =>
        guarded(() => boardsApi.updateItem(boardId, itemId, { assignees })),
      deleteItem: itemId =>
        guarded(() => boardsApi.deleteItem(boardId, itemId)),
      openItem: itemId => {
        searchParams.set('item', itemId);
        setSearchParams(searchParams);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardsApi, boardId, searchParams, setSearchParams],
  );

  if (boardLoading) {
    return <Text style={{ padding: 16 }}>Loading board…</Text>;
  }
  if (boardError || !board) {
    return (
      <Text style={{ padding: 16 }}>
        Board could not be loaded: {(boardError as Error)?.message ?? 'not found'}
      </Text>
    );
  }

  const archived = !!board.archivedAt;
  const canWrite = levelIncludes(board.access, 'write') && !archived;
  const isAdmin = levelIncludes(board.access, 'admin') && !archived;
  const isArchivedAdmin =
    levelIncludes(board.access, 'admin') && archived;
  const purgeDate = board.archivedAt
    ? new Date(
        new Date(board.archivedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString()
    : undefined;
  const openItemId = searchParams.get('item') ?? undefined;
  const openItem = (items ?? []).find(item => item.id === openItemId);

  const allTags = [...new Set((items ?? []).flatMap(item => item.tags))].sort();
  const filter: ItemFilter = {
    text: filterText,
    tags: filterTags,
  };
  const filteredItems = (items ?? []).filter(item =>
    itemMatchesFilter(item, filter),
  );
  const filterActive = !isEmptyFilter(filter);

  const entitySection: React.ReactNode =
    board.entityRefs.length > 0 ? (
      <Text variant="body-small">
        {board.entityRefs.map((ref, index) => (
          <span key={ref}>
            {index > 0 && ', '}
            <EntityRefLink entityRef={ref} />
          </span>
        ))}
      </Text>
    ) : (
      <Text variant="body-small" color="secondary">
        none
      </Text>
    );

  const basePath = rootLink?.() ?? '/boards';

  const content = (
      <Flex direction="column" gap="3" style={{ padding: 16 }}>
        {archived && (
          <Alert
            status="warning"
            title="This board is archived and read-only"
            description={`It is no longer listed and will be permanently deleted on ${purgeDate}. Until then only admins can view it via this link.`}
            customActions={
              isArchivedAdmin ? (
                <Flex gap="2">
                  <Button
                    variant="secondary"
                    size="small"
                    onPress={() =>
                      guarded(() => boardsApi.unarchiveBoard(board.id))
                    }
                  >
                    Unarchive
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    destructive
                    onPress={() => setDeleteOpen(true)}
                  >
                    Delete now
                  </Button>
                </Flex>
              ) : undefined
            }
          />
        )}
      <Flex align="center" gap="2" justify="between" style={{ flexWrap: 'wrap' }}>
        <Flex align="center" gap="2">
          <InlineEdit
            value={board.name}
            canEdit={isAdmin}
            ariaLabel="board name"
            onCommit={name =>
              guarded(() => boardsApi.updateBoard(board.id, { name }))
            }
            display={
              <Text variant="title-medium" as="h1">
                {board.name}
              </Text>
            }
          />
          <ButtonIcon
            aria-label={
              board.favorite ? 'Remove from favorites' : 'Add to favorites'
            }
            variant="tertiary"
            size="small"
            icon={<StarIcon filled={board.favorite} />}
            onPress={() =>
              guarded(() => boardsApi.setFavorite(board.id, !board.favorite))
            }
          />
        </Flex>
        <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
          <WatchButton
            watching={board.watching}
            targetLabel="this board"
            onToggle={watching =>
              guarded(() => boardsApi.setWatchBoard(board.id, watching))
            }
            loadWatchers={() => boardsApi.listBoardWatchers(board.id)}
          />
          <Select
            aria-label="Group by"
            size="small"
            options={[
              { value: 'none', label: 'Not grouped' },
              { value: 'assignee', label: 'By assignee' },
              { value: 'dueDate', label: 'By due date' },
              { value: 'tags', label: 'By tags' },
            ]}
            selectedKey={groupBy}
            onSelectionChange={key => setGroupBy((key as GroupByMode) ?? 'none')}
          />
          <ToggleButtonGroup
            aria-label="View"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[view]}
            onSelectionChange={keys => {
              const [key] = [...keys];
              if (key) setView(key as 'board' | 'table');
            }}
          >
            <ToggleButton id="board" aria-label="Board view">
              <RiKanbanView size={16} />
            </ToggleButton>
            <ToggleButton id="table" aria-label="Table view">
              <RiGridLine size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
          <MenuTrigger>
            <ButtonIcon
              aria-label="More board actions"
              variant="tertiary"
              size="small"
              icon={<RiMore2Fill size={16} />}
            />
            <Menu aria-label="Board actions">
              <MenuItem
                iconStart={<RiHistoryLine size={16} />}
                onAction={() => setChangesOpen(true)}
              >
                Recent changes…
              </MenuItem>
              {canWrite && (
                <MenuItem
                  iconStart={<RiArchiveLine size={16} />}
                  onAction={() => setArchivedOpen(true)}
                >
                  Archived items…
                </MenuItem>
              )}
              <MenuItem
                iconStart={<RiFileCopyLine size={16} />}
                onAction={() => setDuplicateOpen(true)}
              >
                Duplicate board…
              </MenuItem>
              {isAdmin && (
                <MenuItem
                  iconStart={<RiSettings3Line size={16} />}
                  onAction={() => setSettingsOpen(true)}
                >
                  Board settings…
                </MenuItem>
              )}
              {isAdmin && (
                <MenuItem
                  iconStart={<RiLockUnlockLine size={16} />}
                  onAction={() => setShareOpen(true)}
                >
                  Share…
                </MenuItem>
              )}
              {isAdmin && (
                <MenuItem
                  iconStart={<RiDeleteBinLine size={16} />}
                  color="danger"
                  onAction={() => setDeleteOpen(true)}
                >
                  Archive board…
                </MenuItem>
              )}
            </Menu>
          </MenuTrigger>
        </Flex>
      </Flex>

      <Flex align="center" gap="2">
        <Text variant="body-small" color="secondary">
          Entities:
        </Text>
        {entitySection}
        <Text variant="body-small" color="secondary">
          · your access: {board.access}
        </Text>
      </Flex>

      <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
        <div style={{ width: 240, flexShrink: 0 }}>
          <SearchField
            aria-label="Search items"
            placeholder="Search items…"
            value={filterText}
            onChange={setFilterText}
            size="small"
          />
        </div>
        {allTags.length > 0 && (
          <MenuTrigger>
            <Button variant="tertiary" size="small">
              Tags{filterTags.length > 0 ? ` (${filterTags.length})` : ''}
            </Button>
            <Menu aria-label="Filter by tags">
              {allTags.map(tag => (
                <MenuItem
                  key={tag}
                  onAction={() =>
                    setFilterTags(current =>
                      current.includes(tag)
                        ? current.filter(entry => entry !== tag)
                        : [...current, tag],
                    )
                  }
                >
                  {filterTags.includes(tag) ? `✓ ${tag}` : tag}
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
        )}
        {filterActive && (
          <>
            <Text
              variant="body-small"
              color="secondary"
              style={{ flexGrow: 1 }}
            >
              {filteredItems.length} of {(items ?? []).length} items
            </Text>
            <Button
              variant="tertiary"
              size="small"
              onPress={() => {
                setFilterText('');
                setFilterTags([]);
                              }}
            >
              Clear filters
            </Button>
          </>
        )}
      </Flex>

      {error && (
        <Text
          variant="body-small"
          style={{ color: '#cc3344' }}
        >
          {error}
        </Text>
      )}

      {view === 'board' ? (
        <KanbanView
          board={board}
          items={filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
        />
      ) : (
        <TableView
          board={board}
          items={filteredItems}
          canWrite={canWrite}
          actions={actions}
          groupBy={groupBy}
          openItem={actions.openItem}
        />
      )}

      {openItem && (
        <ItemDrawer
          board={board}
          item={openItem}
          canWrite={canWrite}
          tagSuggestions={allTags}
          onClose={() => {
            searchParams.delete('item');
            setSearchParams(searchParams);
          }}
          onChanged={refreshAll}
        />
      )}

      <BoardSettingsDialog
        board={board}
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        onChanged={refreshAll}
      />

      <ShareDialog
        board={board}
        isOpen={shareOpen}
        onOpenChange={setShareOpen}
        onChanged={refreshAll}
      />

      <RecentChangesDialog
        boardId={board.id}
        isOpen={changesOpen}
        onOpenChange={setChangesOpen}
        onOpenItem={actions.openItem}
      />

      <ArchivedItemsDialog
        boardId={board.id}
        canWrite={canWrite}
        isOpen={archivedOpen}
        onOpenChange={setArchivedOpen}
        onChanged={refreshAll}
      />

      <DuplicateBoardDialog
        board={board}
        isOpen={duplicateOpen}
        onOpenChange={setDuplicateOpen}
      />

      <Dialog isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          {archived
            ? `Permanently delete “${board.name}”`
            : `Archive board “${board.name}”`}
        </DialogHeader>
        <DialogBody>
          <Text>
            {archived
              ? 'This permanently deletes the board with all items, comments, and history right now. This cannot be undone.'
              : 'The board becomes read-only, disappears from all lists, and stays reachable for admins via its link. It is permanently deleted after 30 days.'}
          </Text>
        </DialogBody>
        <DialogFooter>
          <Flex gap="2">
            <Button variant="secondary" onPress={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              destructive
              onPress={async () => {
                if (archived) {
                  await boardsApi.hardDeleteBoard(board.id);
                } else {
                  await boardsApi.deleteBoard(board.id);
                }
                if (embedded) {
                  await refreshAll();
                } else {
                  navigate(basePath);
                }
              }}
            >
              {archived ? 'Delete now' : 'Archive board'}
            </Button>
          </Flex>
        </DialogFooter>
      </Dialog>
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

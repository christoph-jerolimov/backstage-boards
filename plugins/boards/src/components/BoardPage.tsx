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
  RiMore2Fill,
} from '@remixicon/react';
import {
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
  Switch,
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
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const rootLink = useRouteRef(rootRouteRef);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [groupBy, setGroupBy] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editEntity, setEditEntity] = useState(false);
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
      setError((err as Error).message);
      await refreshAll();
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

  const canWrite = levelIncludes(board.access, 'write');
  const isAdmin = levelIncludes(board.access, 'admin');
  const openItemId = searchParams.get('item') ?? undefined;
  const openItem = (items ?? []).find(item => item.id === openItemId);

  const allTags = [...new Set((items ?? []).flatMap(item => item.tags))].sort();
  const allLabelPairs = [
    ...new Set(
      (items ?? []).flatMap(item =>
        Object.entries(item.labels).map(([key, value]) => `${key}=${value}`),
      ),
    ),
  ].sort();
  const filter: ItemFilter = {
    text: filterText,
    tags: filterTags,
    labels: Object.fromEntries(
      filterLabels.map(pair => {
        const eq = pair.indexOf('=');
        return [pair.slice(0, eq), pair.slice(eq + 1)];
      }),
    ),
  };
  const filteredItems = (items ?? []).filter(item =>
    itemMatchesFilter(item, filter),
  );
  const filterActive = !isEmptyFilter(filter);

  let entitySection: React.ReactNode;
  if (editEntity) {
    entitySection = (
      <InlineEdit
        value={board.entityRef ?? ''}
        canEdit
        ariaLabel="assigned entity ref"
        placeholder="e.g. system:default/payments"
        onCommit={async entityRef => {
          setEditEntity(false);
          await guarded(() => boardsApi.updateBoard(board.id, { entityRef }));
        }}
      />
    );
  } else if (board.entityRef) {
    entitySection = (
      <Flex align="center" gap="1">
        <Text variant="body-small">
          <EntityRefLink entityRef={board.entityRef} />
        </Text>
        {isAdmin && (
          <>
            <Button
              variant="tertiary"
              size="small"
              onPress={() => setEditEntity(true)}
            >
              Change
            </Button>
            <Button
              variant="tertiary"
              size="small"
              onPress={() =>
                guarded(() =>
                  boardsApi.updateBoard(board.id, { entityRef: null }),
                )
              }
            >
              Clear
            </Button>
          </>
        )}
      </Flex>
    );
  } else {
    entitySection = (
      <Flex align="center" gap="1">
        <Text variant="body-small" color="secondary">
          none
        </Text>
        {isAdmin && (
          <Button
            variant="tertiary"
            size="small"
            onPress={() => setEditEntity(true)}
          >
            Assign
          </Button>
        )}
      </Flex>
    );
  }

  const basePath = rootLink?.() ?? '/boards';

  return (
    <BreadcrumbEntry
      entry={{ href: `${basePath}/${board.id}`, label: board.name }}
    >
      <Flex direction="column" gap="3" style={{ padding: 16 }}>
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
          <Switch
            label="Group by assignee"
            isSelected={groupBy}
            onChange={setGroupBy}
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
                  Delete board…
                </MenuItem>
              )}
            </Menu>
          </MenuTrigger>
        </Flex>
      </Flex>

      <Flex align="center" gap="2">
        <Text variant="body-small" color="secondary">
          Entity:
        </Text>
        {entitySection}
        <Text variant="body-small" color="secondary">
          · your access: {board.access}
        </Text>
      </Flex>

      <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
        <SearchField
          aria-label="Search items"
          placeholder="Search items…"
          value={filterText}
          onChange={setFilterText}
          size="small"
        />
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
        {allLabelPairs.length > 0 && (
          <MenuTrigger>
            <Button variant="tertiary" size="small">
              Labels{filterLabels.length > 0 ? ` (${filterLabels.length})` : ''}
            </Button>
            <Menu aria-label="Filter by labels">
              {allLabelPairs.map(pair => (
                <MenuItem
                  key={pair}
                  onAction={() =>
                    setFilterLabels(current =>
                      current.includes(pair)
                        ? current.filter(entry => entry !== pair)
                        : [...current, pair],
                    )
                  }
                >
                  {filterLabels.includes(pair) ? `✓ ${pair}` : pair}
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
        )}
        {filterActive && (
          <>
            <Text variant="body-small" color="secondary">
              {filteredItems.length} of {(items ?? []).length} items
            </Text>
            <Button
              variant="tertiary"
              size="small"
              onPress={() => {
                setFilterText('');
                setFilterTags([]);
                setFilterLabels([]);
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
          groupBy={groupBy}
          openItem={actions.openItem}
        />
      )}

      {openItem && (
        <ItemDrawer
          board={board}
          item={openItem}
          canWrite={canWrite}
          onClose={() => {
            searchParams.delete('item');
            setSearchParams(searchParams);
          }}
          onChanged={refreshAll}
        />
      )}

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
        <DialogHeader>Delete board “{board.name}”</DialogHeader>
        <DialogBody>
          <Text>
            This permanently deletes the board with all items, comments, and
            history. This cannot be undone.
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
                await boardsApi.deleteBoard(board.id);
                navigate('..');
              }}
            >
              Delete board
            </Button>
          </Flex>
        </DialogFooter>
      </Dialog>
      </Flex>
    </BreadcrumbEntry>
  );
}

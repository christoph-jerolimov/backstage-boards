import { useEffect, useState } from 'react';
import { VisuallyHidden } from 'react-aria';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Cell,
  Column,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Menu,
  MenuItem,
  Row,
  Tab,
  TableBody,
  TableHeader,
  TableRoot,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextField,
} from '@backstage/ui';
import { RiArrowRightLine } from '@remixicon/react';
import {
  BoardListEntry,
  BoardListFilter,
  errorMessage,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import {
  boardsQueryClient,
  queryKeys,
  useBoardsPageQuery,
  useBoardsSignal,
} from '../queries';
import { BoardsFilterBar, useBoardFilter } from './BoardsFilterBar';
import { MyItemsList } from './MyItemsPage';
import { ActionsCellContent, useRowMenu, utilityColumnStyle } from './RowMenu';
import { AsyncList, EntityRefList, ErrorText } from './common';
import {
  DEFAULT_PAGE_SIZE,
  PageSize,
  TablePagination,
} from './TablePagination';
import { FavoriteButton, FavoriteStar } from './FavoriteButton';
import { useAsyncAction } from './useAsyncAction';

/** Stable so the favorites tab's paging effect does not reset every render. */
const FAVORITES_FILTER: BoardListFilter = { favoritesOnly: true };

/** The shared board actions menu: row button and right-click alike. */
function BoardMenu(props: {
  board: BoardListEntry;
  onOpen: (board: BoardListEntry) => void;
  onToggleFavorite: (board: BoardListEntry) => void;
}) {
  const { board, onOpen, onToggleFavorite } = props;
  return (
    <Menu aria-label={`Actions for ${board.name}`}>
      <MenuItem
        iconStart={<RiArrowRightLine size={16} />}
        onAction={() => onOpen(board)}
      >
        Open board
      </MenuItem>
      <MenuItem
        iconStart={<FavoriteStar favorite={board.favorite} />}
        onAction={() => onToggleFavorite(board)}
      >
        {board.favorite ? 'Remove from favorites' : 'Add to favorites'}
      </MenuItem>
    </Menu>
  );
}

function BoardsTable(props: {
  label: string;
  boards: BoardListEntry[];
  onToggleFavorite: (board: BoardListEntry) => void;
}) {
  const { label, boards, onToggleFavorite } = props;
  const navigate = useNavigate();
  const openBoard = (board: BoardListEntry) => navigate(board.id);
  const rowMenu = useRowMenu<BoardListEntry>({
    name: board => board.name,
    children: board => (
      <BoardMenu
        board={board}
        onOpen={openBoard}
        onToggleFavorite={onToggleFavorite}
      />
    ),
  });
  return (
    <>
      <TableRoot aria-label={label} onRowAction={key => navigate(String(key))}>
        <TableHeader>
          <Column style={utilityColumnStyle}>
            <VisuallyHidden>Favorite</VisuallyHidden>
          </Column>
          <Column isRowHeader>Name</Column>
          <Column>Entities</Column>
          <Column>Access</Column>
          <Column style={utilityColumnStyle}>
            <VisuallyHidden>Actions</VisuallyHidden>
          </Column>
        </TableHeader>
        <TableBody>
          {boards.map(board => (
            <Row
              key={board.id}
              id={board.id}
              onContextMenu={(event: React.MouseEvent) =>
                rowMenu.onContextMenu(board, event)
              }
            >
              <Cell>
                <FavoriteButton
                  favorite={board.favorite}
                  boardName={board.name}
                  onToggle={() => onToggleFavorite(board)}
                />
              </Cell>
              <Cell>{board.name}</Cell>
              <Cell>
                <EntityRefList entityRefs={board.entityRefs} />
              </Cell>
              <Cell>{board.access}</Cell>
              <Cell>
                <ActionsCellContent>
                  {rowMenu.rowActions(board)}
                </ActionsCellContent>
              </Cell>
            </Row>
          ))}
        </TableBody>
      </TableRoot>
      {rowMenu.contextMenu}
    </>
  );
}

/** One tab's page of boards: the listing query plus its paging state. */
function useBoardsPage(filter: BoardListFilter) {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const query = useBoardsPageQuery({
    ...filter,
    limit: Number(pageSize),
    offset,
  });
  // a narrowing filter can otherwise leave the user on a page that no
  // longer exists; the filter itself is a fresh object every render, so
  // the effect keys on its content
  const filterKey = JSON.stringify(filter);
  useEffect(() => setOffset(0), [filterKey]);
  return {
    ...query,
    offset,
    setOffset,
    pageSize,
    changePageSize: (size: PageSize) => {
      setPageSize(size);
      setOffset(0);
    },
  };
}

/** A tab's table with its pagination footer, or why it is empty. */
function BoardsPanel(props: {
  label: string;
  page: ReturnType<typeof useBoardsPage>;
  empty: React.ReactNode;
  onToggleFavorite: (board: BoardListEntry) => void;
  /** The filter bar, on the tab that has one. */
  children?: React.ReactNode;
}) {
  const { label, page, empty, onToggleFavorite, children } = props;
  return (
    <Flex direction="column" gap="4">
      {children}
      <AsyncList
        isLoading={page.isLoading}
        error={page.error}
        items={page.data?.boards}
        loading={<Text>Loading boards…</Text>}
        renderError={message => (
          <ErrorText>Boards could not be loaded: {message}</ErrorText>
        )}
        empty={empty}
      >
        {boards => (
          <>
            <BoardsTable
              label={label}
              boards={boards}
              onToggleFavorite={onToggleFavorite}
            />
            <TablePagination
              noun="boards"
              total={page.data?.total ?? boards.length}
              offset={page.offset}
              count={boards.length}
              pageSize={page.pageSize}
              onOffsetChange={page.setOffset}
              onPageSizeChange={page.changePageSize}
            />
          </>
        )}
      </AsyncList>
    </Flex>
  );
}

export function BoardListPage() {
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('favorites');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const {
    error,
    pending: creating,
    run,
  } = useAsyncAction({
    formatError: err => `Could not create board: ${errorMessage(err)}`,
  });

  const filter = useBoardFilter();
  const favorites = useBoardsPage(FAVORITES_FILTER);
  const all = useBoardsPage(filter.filter);

  useBoardsSignal(() => {
    boardsQueryClient.invalidateQueries({ queryKey: queryKeys.boardsPage });
    // a board created or archived elsewhere changes what the dropdowns offer
    boardsQueryClient.invalidateQueries({ queryKey: queryKeys.filterOptions });
  });

  const toggleFavorite = async (board: BoardListEntry) => {
    await boardsApi.setFavorite(board.id, !board.favorite);
    // the star moves a board between the two tabs, so both are stale
    await Promise.all([favorites.refetch(), all.refetch()]);
  };

  const createBoard = async () => {
    if (!newName.trim() || creating) {
      return;
    }
    await run(async () => {
      const board = await boardsApi.createBoard({ name: newName.trim() });
      setCreateOpen(false);
      setNewName('');
      navigate(board.id);
    });
  };

  return (
    <Flex direction="column" gap="4" style={{ padding: 16 }}>
      <Flex align="center" justify="between">
        <Text variant="title-medium" as="h1">
          Boards
        </Text>
        <Button variant="primary" onPress={() => setCreateOpen(true)}>
          Create board
        </Button>
      </Flex>
      {error && <ErrorText>{error}</ErrorText>}
      <Tabs selectedKey={tab} onSelectionChange={key => setTab(String(key))}>
        <TabList>
          <Tab id="favorites">Favorites ({favorites.data?.total ?? 0})</Tab>
          {/* the caller's whole readable set, so filtering never moves it */}
          <Tab id="all">All ({filter.options?.total ?? 0})</Tab>
          <Tab id="my-items">My items</Tab>
        </TabList>
        <TabPanel id="favorites">
          <BoardsPanel
            label="Favorite boards"
            page={favorites}
            onToggleFavorite={toggleFavorite}
            empty={
              <Text color="secondary">
                No favorite boards yet — star a board in the All tab.
              </Text>
            }
          />
        </TabPanel>
        <TabPanel id="all">
          <BoardsPanel
            label="All boards"
            page={all}
            onToggleFavorite={toggleFavorite}
            empty={
              filter.active ? (
                // the bar right above holds the clear action; a second
                // one here would be two controls doing one thing
                <Text color="secondary">No boards match your filters.</Text>
              ) : (
                <Text color="secondary">
                  No boards are accessible to you yet. Create one!
                </Text>
              )
            }
          >
            <BoardsFilterBar
              filter={filter}
              matchCount={all.data?.total ?? 0}
            />
          </BoardsPanel>
        </TabPanel>
        <TabPanel id="my-items">
          <MyItemsList />
        </TabPanel>
      </Tabs>
      <Dialog
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        style={{ width: '800px', maxWidth: '95%' }}
      >
        <DialogHeader>Create board</DialogHeader>
        <DialogBody>
          <TextField
            label="Board name"
            value={newName}
            onChange={setNewName}
            placeholder="e.g. Team Alpha"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
            autoFocus
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                createBoard();
              }
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Flex gap="2">
            <Button variant="secondary" onPress={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isPending={creating}
              onPress={createBoard}
            >
              Create
            </Button>
          </Flex>
        </DialogFooter>
      </Dialog>
    </Flex>
  );
}

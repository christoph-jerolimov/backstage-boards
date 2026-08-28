import { useMemo, useState } from 'react';
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
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { BoardListEntry } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import {
  boardsQueryClient,
  queryKeys,
  useBoardsQuery,
  useBoardsSignal,
} from '../queries';
import { MyItemsList } from './MyItemsPage';
import { RowActionsMenu, RowContextMenu, useRowContextMenu } from './RowMenu';
import { ErrorText } from './common';
import { FavoriteButton, FavoriteStar } from './FavoriteButton';
import { useAsyncAction } from './useAsyncAction';

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
  emptyText: string;
}) {
  const { label, boards, onToggleFavorite, emptyText } = props;
  const navigate = useNavigate();
  const contextMenu = useRowContextMenu<BoardListEntry>();
  const openBoard = (board: BoardListEntry) => navigate(board.id);
  if (boards.length === 0) {
    return <Text>{emptyText}</Text>;
  }
  return (
    <>
      <TableRoot aria-label={label} onRowAction={key => navigate(String(key))}>
        <TableHeader>
          <Column>Favorite</Column>
          <Column isRowHeader>Name</Column>
          <Column>Entities</Column>
          <Column>Access</Column>
          <Column>Actions</Column>
        </TableHeader>
        <TableBody>
          {boards.map(board => (
            <Row
              key={board.id}
              id={board.id}
              onContextMenu={(event: React.MouseEvent) =>
                contextMenu.open(board, event)
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
                {board.entityRefs.map((ref, index) => (
                  <span key={ref}>
                    {index > 0 && ', '}
                    <EntityRefLink entityRef={ref} />
                  </span>
                ))}
              </Cell>
              <Cell>{board.access}</Cell>
              <Cell>
                <RowActionsMenu label={`Actions for ${board.name}`}>
                  <BoardMenu
                    board={board}
                    onOpen={openBoard}
                    onToggleFavorite={onToggleFavorite}
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
        label={board => `Context menu for ${board.name}`}
      >
        {board => (
          <BoardMenu
            board={board}
            onOpen={openBoard}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      </RowContextMenu>
    </>
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
    formatError: err => `Could not create board: ${err.message}`,
  });

  const {
    data: boards,
    isLoading: loading,
    refetch: refresh,
  } = useBoardsQuery();

  useBoardsSignal(() =>
    boardsQueryClient.invalidateQueries({
      queryKey: queryKeys.boards,
      exact: true,
    }),
  );

  const favorites = useMemo(
    () => (boards ?? []).filter(board => board.favorite),
    [boards],
  );

  const toggleFavorite = async (board: BoardListEntry) => {
    await boardsApi.setFavorite(board.id, !board.favorite);
    await refresh();
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
      {loading ? (
        <Text>Loading boards…</Text>
      ) : (
        <Tabs selectedKey={tab} onSelectionChange={key => setTab(String(key))}>
          <TabList>
            <Tab id="favorites">Favorites ({favorites.length})</Tab>
            <Tab id="all">All ({(boards ?? []).length})</Tab>
            <Tab id="my-items">My items</Tab>
          </TabList>
          <TabPanel id="favorites">
            <BoardsTable
              label="Favorite boards"
              boards={favorites}
              onToggleFavorite={toggleFavorite}
              emptyText="No favorite boards yet — star a board in the All tab."
            />
          </TabPanel>
          <TabPanel id="all">
            <BoardsTable
              label="All boards"
              boards={boards ?? []}
              onToggleFavorite={toggleFavorite}
              emptyText="No boards are accessible to you yet. Create one!"
            />
          </TabPanel>
          <TabPanel id="my-items">
            <MyItemsList />
          </TabPanel>
        </Tabs>
      )}
      <Dialog isOpen={createOpen} onOpenChange={setCreateOpen}>
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

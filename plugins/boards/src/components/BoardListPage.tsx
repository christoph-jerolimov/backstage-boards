import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@backstage/frontend-plugin-api';
import { useSignal } from '@backstage/plugin-signals-react';
import {
  Button,
  ButtonIcon,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextField,
} from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { BoardListEntry } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { useBoardsQuery, boardsQueryClient, queryKeys } from '../queries';

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

function BoardRows(props: {
  boards: BoardListEntry[];
  onToggleFavorite: (board: BoardListEntry) => void;
  emptyText: string;
}) {
  const navigate = useNavigate();
  if (props.boards.length === 0) {
    return <Text>{props.emptyText}</Text>;
  }
  return (
    <Flex direction="column" gap="2">
      {props.boards.map(board => (
        <Flex
          key={board.id}
          align="center"
          gap="3"
          style={{
            border: '1px solid var(--bui-border, #ddd)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <ButtonIcon
            aria-label={
              board.favorite
                ? `Remove ${board.name} from favorites`
                : `Add ${board.name} to favorites`
            }
            variant="tertiary"
            size="small"
            icon={<StarIcon filled={board.favorite} />}
            onPress={() => props.onToggleFavorite(board)}
          />
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <Button
              variant="tertiary"
              onPress={() => navigate(board.id)}
              aria-label={`Open board ${board.name}`}
            >
              {board.name}
            </Button>
          </div>
          {board.entityRef && (
            <Text variant="body-small">
              <EntityRefLink entityRef={board.entityRef} />
            </Text>
          )}
          <Text variant="body-small" color="secondary">
            {board.access}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

export function BoardListPage() {
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('favorites');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { data: boards, isLoading: loading, refetch: refresh } = useBoardsQuery();

  const { lastSignal } = useSignal('boards');
  useEffect(() => {
    if (lastSignal) {
      boardsQueryClient.invalidateQueries({
        queryKey: queryKeys.boards,
        exact: true,
      });
    }
  }, [lastSignal]);

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
    setCreating(true);
    setError(undefined);
    try {
      const board = await boardsApi.createBoard({ name: newName.trim() });
      setCreateOpen(false);
      setNewName('');
      navigate(board.id);
    } catch (err) {
      setError(`Could not create board: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
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
      {error && <Text color="danger">{error}</Text>}
      {loading ? (
        <Text>Loading boards…</Text>
      ) : (
        <Tabs selectedKey={tab} onSelectionChange={key => setTab(String(key))}>
          <TabList>
            <Tab id="favorites">Favorites ({favorites.length})</Tab>
            <Tab id="all">All ({(boards ?? []).length})</Tab>
          </TabList>
          <TabPanel id="favorites">
            <BoardRows
              boards={favorites}
              onToggleFavorite={toggleFavorite}
              emptyText="No favorite boards yet — star a board in the All tab."
            />
          </TabPanel>
          <TabPanel id="all">
            <BoardRows
              boards={boards ?? []}
              onToggleFavorite={toggleFavorite}
              emptyText="No boards are accessible to you yet. Create one!"
            />
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

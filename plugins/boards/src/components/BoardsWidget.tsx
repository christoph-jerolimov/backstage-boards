import { useNavigate } from 'react-router-dom';
import { Button, Flex, Text } from '@backstage/ui';
import {
  BoardListEntry,
  BoardStatusCount,
  COLUMN_COLORS,
} from '@internal/plugin-boards-common';
import { useBoardListQuery, useBoardsSignal } from '../queries';
import { useBoardsBasePath } from '../routes';
import { AsyncList, ErrorText } from './common';

export { BoardsWidgetProvider } from './widgetCommon';

/** Which boards the card shows. */
export type BoardsScope = 'favorites' | 'all';

/**
 * Settings arrive from the home page grid as props, and an unconfigured
 * card arrives with none at all — hence the defaults in the component.
 */
export interface BoardsContentProps {
  scope?: BoardsScope;
  showCounts?: boolean;
}

const NEUTRAL = '#8a8f98';

/** One `<title> <count>` chip, tinted with the column's color. */
function StatusCountChip(props: { count: BoardStatusCount }) {
  const { count } = props;
  const hex = count.color ? COLUMN_COLORS[count.color] : NEUTRAL;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 6px',
        borderRadius: 10,
        background: `${hex}22`,
        border: `1px solid ${hex}55`,
        fontSize: '0.75em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: hex,
          flexShrink: 0,
        }}
      />
      {count.title} {count.count}
    </span>
  );
}

function BoardRow(props: {
  board: BoardListEntry;
  showCounts: boolean;
  onOpen: (board: BoardListEntry) => void;
}) {
  const { board, showCounts, onOpen } = props;
  return (
    <Flex direction="column" gap="1">
      <Button
        variant="tertiary"
        size="small"
        onPress={() => onOpen(board)}
        aria-label={`Open board ${board.name}`}
      >
        <Text variant="body-small">{board.name}</Text>
      </Button>
      {showCounts && (
        <Flex gap="1" style={{ flexWrap: 'wrap' }}>
          {(board.statusCounts ?? []).map(count => (
            <StatusCountChip key={count.columnId} count={count} />
          ))}
        </Flex>
      )}
    </Flex>
  );
}

/**
 * The "Boards" home page card: the boards the user can reach, optionally
 * with the number of items per status.
 */
export function BoardsContent(props: BoardsContentProps) {
  const { scope = 'favorites', showCounts = false } = props;
  const navigate = useNavigate();
  const basePath = useBoardsBasePath();

  const {
    data: boards,
    isLoading,
    error,
    refetch,
  } = useBoardListQuery({
    favoritesOnly: scope === 'favorites',
    withCounts: showCounts,
  });

  useBoardsSignal(refetch);

  return (
    <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
      <AsyncList
        isLoading={isLoading}
        error={error}
        items={boards}
        loading={<Text>Loading boards…</Text>}
        renderError={message => (
          <ErrorText>Boards could not be loaded: {message}</ErrorText>
        )}
        empty={
          <Flex direction="column" gap="2" align="start">
            <Text color="secondary">
              {scope === 'favorites'
                ? 'You have not favorited any board yet.'
                : 'You cannot access any board yet.'}
            </Text>
            <Button
              variant="tertiary"
              size="small"
              onPress={() => navigate(basePath)}
              aria-label="Open the boards page"
            >
              Go to boards
            </Button>
          </Flex>
        }
      >
        {found => (
          <Flex direction="column" gap="3">
            {found.map(board => (
              <BoardRow
                key={board.id}
                board={board}
                showCounts={showCounts}
                onOpen={() => navigate(`${basePath}/${board.id}`)}
              />
            ))}
          </Flex>
        )}
      </AsyncList>
    </div>
  );
}

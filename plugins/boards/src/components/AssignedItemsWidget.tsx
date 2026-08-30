import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Flex, Text } from '@backstage/ui';
import { MyBoardItem } from '@internal/plugin-boards-common';
import { useBoardsSignal, useMyItemsQuery } from '../queries';
import { useBoardsBasePath } from '../routes';
import {
  AsyncList,
  ErrorText,
  DueDateBadge,
  formatDueDate,
  PriorityChip,
} from '@internal/plugin-boards-react';
import { ItemDrawerHost } from './ItemDrawerHost';
import {
  filterDueEntries,
  groupMyItems,
  MyItemGroup,
  MyItemsGroupBy,
  NO_DUE_DATE,
} from './grouping';

export { BoardsWidgetProvider } from './widgetCommon';

/** Which assigned items the card shows. */
export type AssignedItemsScope = 'all' | 'due';

/**
 * Settings arrive from the home page grid as props, and an unconfigured
 * card arrives with none at all — the schema's `default` is documentation,
 * not a runtime guarantee. Hence the defaults here.
 */
export interface AssignedItemsContentProps {
  scope?: AssignedItemsScope;
  groupBy?: MyItemsGroupBy;
}

/** The group's heading: label, item count, and a link when it is a board. */
function GroupHeading(props: {
  group: MyItemGroup;
  groupBy: MyItemsGroupBy;
  onOpenBoard: (boardId: string) => void;
}) {
  const { group, groupBy, onOpenBoard } = props;
  const label =
    groupBy === 'dueDate' && group.key !== NO_DUE_DATE
      ? formatDueDate(group.label)
      : group.label;
  const count = (
    <Text variant="body-x-small" color="secondary">
      {group.entries.length}
    </Text>
  );
  if (groupBy === 'board') {
    return (
      <Flex align="center" gap="2">
        <Button
          variant="tertiary"
          size="small"
          onPress={() => onOpenBoard(group.key)}
          aria-label={`Open board ${label}`}
        >
          <Text variant="body-small" weight="bold">
            {label}
          </Text>
        </Button>
        {count}
      </Flex>
    );
  }
  return (
    <Flex align="center" gap="2">
      <Text variant="body-small" weight="bold">
        {label}
      </Text>
      {count}
    </Flex>
  );
}

function ItemRow(props: {
  entry: MyBoardItem;
  showStatus: boolean;
  onOpenItem: (entry: MyBoardItem) => void;
}) {
  const { entry, showStatus, onOpenItem } = props;
  return (
    <Button
      variant="tertiary"
      size="small"
      onPress={() => onOpenItem(entry)}
      aria-label={`Open item ${entry.item.title}`}
    >
      <Flex align="center" gap="2">
        <Text variant="body-small">{entry.item.title}</Text>
        {showStatus && <Badge size="small">{entry.columnTitle}</Badge>}
        <PriorityChip priority={entry.priority} size="small" />
        <DueDateBadge dueDate={entry.item.dueDate} />
      </Flex>
    </Button>
  );
}

/**
 * The "Assigned items" home page card: the current user's items across
 * every board they can read, filtered and grouped per the card's settings.
 */
export function AssignedItemsContent(props: AssignedItemsContentProps) {
  const { scope = 'all', groupBy = 'board' } = props;
  const navigate = useNavigate();
  const basePath = useBoardsBasePath();

  const { data: entries, isLoading, error, refetch } = useMyItemsQuery();

  useBoardsSignal(refetch);

  const groups = useMemo(() => {
    const all = entries ?? [];
    return groupMyItems(scope === 'due' ? filterDueEntries(all) : all, groupBy);
  }, [entries, scope, groupBy]);

  const openBoard = (boardId: string) => navigate(`${basePath}/${boardId}`);
  // the open drawer, held as its own copy so it survives the row
  // disappearing (e.g. after the user unassigns themselves)
  const [openEntry, setOpenEntry] = useState<MyBoardItem | undefined>();

  return (
    <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
      <AsyncList
        isLoading={isLoading}
        error={error}
        items={groups}
        loading={<Text>Loading your items…</Text>}
        renderError={message => (
          <ErrorText>Your items could not be loaded: {message}</ErrorText>
        )}
        empty={
          <Text color="secondary">
            {scope === 'due'
              ? 'Nothing of yours is due.'
              : 'Nothing is assigned to you on any board.'}
          </Text>
        }
      >
        {found => (
          <Flex direction="column" gap="3">
            {found.map(group => (
              <Flex direction="column" gap="1" key={group.key}>
                <GroupHeading
                  group={group}
                  groupBy={groupBy}
                  onOpenBoard={openBoard}
                />
                {group.entries.map(entry => (
                  <ItemRow
                    key={`${entry.boardId}/${entry.item.id}`}
                    entry={entry}
                    // redundant when the group already names the status
                    showStatus={groupBy !== 'status'}
                    onOpenItem={setOpenEntry}
                  />
                ))}
              </Flex>
            ))}
          </Flex>
        )}
      </AsyncList>
      {openEntry && (
        <ItemDrawerHost
          boardId={openEntry.boardId}
          itemId={openEntry.item.id}
          fallbackItem={openEntry.item}
          onClose={() => setOpenEntry(undefined)}
        />
      )}
    </div>
  );
}

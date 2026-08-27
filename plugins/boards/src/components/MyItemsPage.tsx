import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BreadcrumbEntry,
  useApi,
  useRouteRef,
} from '@backstage/frontend-plugin-api';
import { useSignal } from '@backstage/plugin-signals-react';
import { Badge, Button, Flex, Text } from '@backstage/ui';
import { MyBoardItem } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { DueDateBadge } from './DueDate';

interface BoardGroup {
  boardId: string;
  boardName: string;
  entries: MyBoardItem[];
}

function groupByBoard(entries: MyBoardItem[]): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();
  for (const entry of entries) {
    let group = groups.get(entry.boardId);
    if (!group) {
      group = {
        boardId: entry.boardId,
        boardName: entry.boardName,
        entries: [],
      };
      groups.set(entry.boardId, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

/** The current user's items grouped by board; reused by the Boards tab. */
export function MyItemsList() {
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const rootLink = useRouteRef(rootRouteRef);
  const basePath = rootLink?.() ?? '/boards';

  const {
    data: entries,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['boards', 'my-items'],
    queryFn: () => boardsApi.listMyItems(),
  });

  const { lastSignal } = useSignal('boards');
  useEffect(() => {
    if (lastSignal) {
      refetch();
    }
  }, [lastSignal, refetch]);

  const groups = useMemo(() => groupByBoard(entries ?? []), [entries]);

  return (
    <Flex direction="column" gap="4">
      {error && (
        <Text style={{ color: 'var(--bui-fg-negative)' }}>
          My items could not be loaded: {(error as Error).message}
        </Text>
      )}
      {isLoading && <Text>Loading your items…</Text>}
      {!isLoading && !error && groups.length === 0 && (
        <Text color="secondary">Nothing is assigned to you on any board.</Text>
      )}
      {groups.map(group => (
        <div key={group.boardId}>
          <Button
            variant="tertiary"
            onPress={() => navigate(`${basePath}/${group.boardId}`)}
            aria-label={`Open board ${group.boardName}`}
          >
            <Text variant="body-large" weight="bold">
              {group.boardName}
            </Text>
          </Button>
          <Flex direction="column" gap="2" mt="2">
            {group.entries.map(({ item, columnTitle }) => (
              <Flex
                key={item.id}
                align="center"
                gap="3"
                style={{
                  border: '1px solid var(--bui-border-1)',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <Button
                    variant="tertiary"
                    onPress={() =>
                      navigate(`${basePath}/${group.boardId}?item=${item.id}`)
                    }
                    aria-label={`Open item ${item.title}`}
                  >
                    {item.title}
                  </Button>
                </div>
                {item.tags.length > 0 && (
                  <Text variant="body-x-small" color="secondary">
                    {item.tags.join(', ')}
                  </Text>
                )}
                <DueDateBadge dueDate={item.dueDate} />
                <Badge size="small">{columnTitle}</Badge>
              </Flex>
            ))}
          </Flex>
        </div>
      ))}
    </Flex>
  );
}

export function MyItemsPage() {
  const rootLink = useRouteRef(rootRouteRef);
  const basePath = rootLink?.() ?? '/boards';
  return (
    <BreadcrumbEntry
      entry={{ href: `${basePath}/my-items`, label: 'My items' }}
    >
      <Flex direction="column" gap="4" style={{ padding: 16 }}>
        <Text variant="title-medium" as="h1">
          My items
        </Text>
        <MyItemsList />
      </Flex>
    </BreadcrumbEntry>
  );
}

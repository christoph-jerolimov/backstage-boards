import { useMemo } from 'react';
import { useRouteRef } from '@backstage/frontend-plugin-api';
import { Flex, Link, Text } from '@backstage/ui';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { QueryClientProvider } from '@tanstack/react-query';
import { rootRouteRef } from '../routes';
import { boardsQueryClient, useBoardsByEntityQuery } from '../queries';

function EntityBoardsList() {
  const { entity } = useEntity();
  const boardsLink = useRouteRef(rootRouteRef);
  const entityRef = useMemo(() => stringifyEntityRef(entity), [entity]);

  const { data: boards, isLoading: loading } = useBoardsByEntityQuery(entityRef);

  if (loading) {
    return <Text>Loading boards…</Text>;
  }
  const assigned = boards ?? [];
  if (assigned.length === 0) {
    return <Text>No boards are assigned to this entity.</Text>;
  }
  const base = boardsLink?.() ?? '/boards';
  return (
    <Flex direction="column" gap="2">
      {assigned.map(board => (
        <Link key={board.id} href={`${base}/${board.id}`}>
          {board.name}
        </Link>
      ))}
    </Flex>
  );
}

/** Lists the boards assigned to the entity currently shown in the catalog. */
export function EntityBoardsContent() {
  return (
    <QueryClientProvider client={boardsQueryClient}>
      <EntityBoardsList />
    </QueryClientProvider>
  );
}

import { useMemo } from 'react';
import { useApi, useRouteRef } from '@backstage/frontend-plugin-api';
import { Flex, Link, Text } from '@backstage/ui';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { useAsyncData } from './common';

/** Lists the boards assigned to the entity currently shown in the catalog. */
export function EntityBoardsContent() {
  const { entity } = useEntity();
  const boardsApi = useApi(boardsApiRef);
  const boardsLink = useRouteRef(rootRouteRef);
  const entityRef = useMemo(() => stringifyEntityRef(entity), [entity]);

  const { data: boards, loading } = useAsyncData(
    () => boardsApi.listBoards(),
    [boardsApi],
  );

  if (loading) {
    return <Text>Loading boards…</Text>;
  }
  const assigned = (boards ?? []).filter(
    board => board.entityRef === entityRef,
  );
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

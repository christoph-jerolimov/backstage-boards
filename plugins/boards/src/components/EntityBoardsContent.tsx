import { useMemo, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs, Text } from '@backstage/ui';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { QueryClientProvider } from '@tanstack/react-query';
import { boardsQueryClient, useBoardsByEntityQuery } from '../queries';
import { BoardPageContent } from './BoardPage';
import { BoardsAccessRestricted, RequireBoardsUse } from './RequireBoardsUse';

function EntityBoardsList() {
  const { entity } = useEntity();
  const entityRef = useMemo(() => stringifyEntityRef(entity), [entity]);

  const { data: boards, isLoading: loading } =
    useBoardsByEntityQuery(entityRef);
  const [tab, setTab] = useState<string | undefined>(undefined);

  if (loading) {
    return <Text>Loading boards…</Text>;
  }
  const assigned = boards ?? [];
  if (assigned.length === 0) {
    // The tab only appears on entities a board references, so an empty list
    // means the viewer cannot access any of those boards.
    return (
      <Text>No boards are assigned to this entity that you can access.</Text>
    );
  }
  if (assigned.length === 1) {
    return <BoardPageContent boardId={assigned[0].id} embedded />;
  }
  return (
    <Tabs
      selectedKey={tab ?? assigned[0].id}
      onSelectionChange={key => setTab(String(key))}
    >
      <TabList>
        {assigned.map(board => (
          <Tab key={board.id} id={board.id}>
            {board.name}
          </Tab>
        ))}
      </TabList>
      {assigned.map(board => (
        <TabPanel key={board.id} id={board.id}>
          <BoardPageContent boardId={board.id} embedded />
        </TabPanel>
      ))}
    </Tabs>
  );
}

/** Shows the boards assigned to the current catalog entity, in full. */
export function EntityBoardsContent() {
  return (
    // The tab itself is offered by the entity filter (which cannot consult
    // permissions), so viewers without `boards.use` get the restricted state
    // here and no boards API call is ever made on their behalf.
    <RequireBoardsUse fallback={<BoardsAccessRestricted />}>
      <QueryClientProvider client={boardsQueryClient}>
        <EntityBoardsList />
      </QueryClientProvider>
    </RequireBoardsUse>
  );
}

import { useApi } from '@backstage/frontend-plugin-api';
import { VisuallyHidden } from 'react-aria';
import {
  Button,
  Cell,
  Column,
  Dialog,
  DialogBody,
  DialogHeader,
  Flex,
  Row,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RETENTION_DAYS } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import {
  AsyncList,
  formatDate,
  RefDisplay,
} from '@internal/plugin-boards-react';
import { ActionsCellContent } from './RowMenu';

/**
 * Archived (soft-deleted) items of a board with restore. Items are
 * purged permanently once the shared retention period is up.
 */
export function ArchivedItemsDialog(props: {
  boardId: string;
  canWrite: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const { boardId, canWrite, isOpen, onOpenChange, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  const queryClient = useQueryClient();
  const archivedKey = queryKeys.archivedItems(boardId);
  const { data: items, isLoading: loading } = useQuery({
    queryKey: archivedKey,
    enabled: isOpen && canWrite,
    queryFn: () => boardsApi.listArchivedItems(boardId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: archivedKey });

  const content = (
    <AsyncList
      isLoading={loading}
      items={items}
      empty={<Text>No archived items.</Text>}
    >
      {archived => (
        <Flex direction="column" gap="2">
          <Text variant="body-small" color="secondary">
            {`Archived items are removed permanently after ${RETENTION_DAYS} days.`}
          </Text>
          <TableRoot aria-label="Archived items">
            <TableHeader>
              <Column isRowHeader>Title</Column>
              <Column>Archived by</Column>
              <Column>Archived</Column>
              {/* wider than the icon columns: it holds a text button */}
              <Column style={{ width: 112 }}>
                <VisuallyHidden>Actions</VisuallyHidden>
              </Column>
            </TableHeader>
            <TableBody>
              {archived.map(item => (
                <Row key={item.id} id={item.id}>
                  <Cell>{item.title}</Cell>
                  <Cell>
                    {item.archivedBy && (
                      <RefDisplay refString={item.archivedBy} />
                    )}
                  </Cell>
                  <Cell>
                    {item.archivedAt ? formatDate(item.archivedAt) : ''}
                  </Cell>
                  <Cell>
                    <ActionsCellContent>
                      <Button
                        variant="secondary"
                        size="small"
                        onPress={async () => {
                          await boardsApi.restoreItem(boardId, item.id);
                          await refresh();
                          await onChanged();
                        }}
                      >
                        Restore
                      </Button>
                    </ActionsCellContent>
                  </Cell>
                </Row>
              ))}
            </TableBody>
          </TableRoot>
        </Flex>
      )}
    </AsyncList>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      style={{ width: '800px', maxWidth: '95%' }}
    >
      <DialogHeader>Archived items</DialogHeader>
      <DialogBody>{content}</DialogBody>
    </Dialog>
  );
}

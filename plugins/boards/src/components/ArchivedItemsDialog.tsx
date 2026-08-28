import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Dialog,
  DialogBody,
  DialogHeader,
  Flex,
  Text,
} from '@backstage/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { AsyncList, formatDate, RefDisplay } from './common';

/**
 * Archived (soft-deleted) items of a board with restore. Items are
 * purged permanently 30 days after archival.
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
            Archived items are removed permanently after 30 days.
          </Text>
          {archived.map(item => (
            <Flex key={item.id} align="center" gap="2" justify="between">
              <div>
                <Text variant="body-medium">{item.title}</Text>
                <Text variant="body-x-small" color="secondary">
                  archived {item.archivedAt ? formatDate(item.archivedAt) : ''}{' '}
                  {item.archivedBy && (
                    <>
                      by <RefDisplay refString={item.archivedBy} />
                    </>
                  )}
                </Text>
              </div>
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
            </Flex>
          ))}
        </Flex>
      )}
    </AsyncList>
  );

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Archived items</DialogHeader>
      <DialogBody>{content}</DialogBody>
    </Dialog>
  );
}

import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Dialog,
  DialogBody,
  DialogHeader,
  Flex,
  Text,
} from '@backstage/ui';
import { boardsApiRef } from '../api';
import { formatDate, RefDisplay, useAsyncData } from './common';

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
  const {
    data: items,
    loading,
    refresh,
  } = useAsyncData(
    () =>
      isOpen && canWrite
        ? boardsApi.listArchivedItems(boardId)
        : Promise.resolve(undefined),
    [boardsApi, boardId, isOpen, canWrite],
  );

  let content;
  if (loading || items === undefined) {
    content = <Text>Loading…</Text>;
  } else if (items.length === 0) {
    content = <Text>No archived items.</Text>;
  } else {
    content = (
      <Flex direction="column" gap="2">
        <Text variant="body-small" color="secondary">
          Archived items are removed permanently after 30 days.
        </Text>
        {items.map(item => (
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
    );
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Archived items</DialogHeader>
      <DialogBody>{content}</DialogBody>
    </Dialog>
  );
}

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
import {
  changeSummary,
  formatDate,
  RefDisplay,
  useAsyncData,
} from './common';

/** Board-wide feed of the most recent change records, newest first. */
export function RecentChangesDialog(props: {
  boardId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const { boardId, isOpen, onOpenChange, onOpenItem } = props;
  const boardsApi = useApi(boardsApiRef);
  const { data: entries, loading } = useAsyncData(
    () =>
      isOpen
        ? boardsApi.getBoardChanges(boardId, { limit: 50 })
        : Promise.resolve(undefined),
    [boardsApi, boardId, isOpen],
  );

  let content;
  if (loading || entries === undefined) {
    content = <Text>Loading…</Text>;
  } else if (entries.length === 0) {
    content = <Text>No changes recorded yet.</Text>;
  } else {
    content = (
      <Flex direction="column" gap="2">
        {entries.map(entry => (
          <Flex key={entry.change.id} align="center" gap="2">
            <Button
              variant="tertiary"
              size="small"
              onPress={() => {
                onOpenChange(false);
                onOpenItem(entry.change.itemId);
              }}
            >
              {entry.itemTitle}
            </Button>
            <Text variant="body-small" color="secondary">
              <RefDisplay refString={entry.change.actorRef} />{' '}
              {changeSummary(entry.change)} · {formatDate(entry.change.at)}
            </Text>
          </Flex>
        ))}
      </Flex>
    );
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Recent changes</DialogHeader>
      <DialogBody>{content}</DialogBody>
    </Dialog>
  );
}

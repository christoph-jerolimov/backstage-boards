import { useApi } from '@backstage/frontend-plugin-api';
import {
  Cell,
  Column,
  Dialog,
  DialogBody,
  DialogHeader,
  Row,
  TableBody,
  TableHeader,
  TableRoot,
  Text,
} from '@backstage/ui';
import { useQuery } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { changeSummary, formatDate, RefDisplay } from './common';

/** Board-wide feed of the most recent change records, newest first. */
export function RecentChangesDialog(props: {
  boardId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const { boardId, isOpen, onOpenChange, onOpenItem } = props;
  const boardsApi = useApi(boardsApiRef);
  const { data: entries, isLoading: loading } = useQuery({
    queryKey: queryKeys.changes(boardId),
    enabled: isOpen,
    queryFn: () => boardsApi.getBoardChanges(boardId, { limit: 50 }),
  });

  let content;
  if (loading || entries === undefined) {
    content = <Text>Loading…</Text>;
  } else if (entries.length === 0) {
    content = <Text>No changes recorded yet.</Text>;
  } else {
    content = (
      <TableRoot
        aria-label="Recent changes"
        onRowAction={key => {
          const entry = entries.find(e => e.change.id === String(key));
          if (entry) {
            onOpenChange(false);
            onOpenItem(entry.change.itemId);
          }
        }}
      >
        <TableHeader>
          <Column isRowHeader>Item</Column>
          <Column>Actor</Column>
          <Column>Change</Column>
          <Column>When</Column>
        </TableHeader>
        <TableBody>
          {entries.map(entry => (
            <Row key={entry.change.id} id={entry.change.id}>
              <Cell>{entry.itemTitle}</Cell>
              <Cell>
                <RefDisplay refString={entry.change.actorRef} />
              </Cell>
              <Cell>{changeSummary(entry.change)}</Cell>
              <Cell>{formatDate(entry.change.at)}</Cell>
            </Row>
          ))}
        </TableBody>
      </TableRoot>
    );
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Recent changes</DialogHeader>
      <DialogBody>{content}</DialogBody>
    </Dialog>
  );
}

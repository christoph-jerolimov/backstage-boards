import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Text,
} from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { BoardWithContext } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ErrorText } from './common';
import { EntityPicker } from './EntityPicker';
import { useAsyncAction } from './useAsyncAction';

/**
 * Board settings: manage the list of catalog entities the board
 * references. Changes are saved immediately.
 */
export function BoardSettingsDialog(props: {
  board: BoardWithContext;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const { board, isOpen, onOpenChange, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  const { error, run } = useAsyncAction();

  const save = (entityRefs: string[]) =>
    run(async () => {
      await boardsApi.updateBoard(board.id, { entityRefs });
      await onChanged();
    });

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Board settings</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Text variant="body-small" color="secondary">
            Referenced catalog entities, e.g. a component and the owning team.
          </Text>
          {error && <ErrorText>{error}</ErrorText>}
          {board.entityRefs.length === 0 && (
            <Text variant="body-small" color="secondary">
              No entities referenced yet.
            </Text>
          )}
          {board.entityRefs.map(ref => (
            <Flex key={ref} align="center" gap="2" justify="between">
              <Text variant="body-small">
                <EntityRefLink entityRef={ref} />
              </Text>
              <Button
                variant="tertiary"
                size="small"
                aria-label={`Remove entity ${ref}`}
                onPress={() =>
                  save(board.entityRefs.filter(entry => entry !== ref))
                }
              >
                Remove
              </Button>
            </Flex>
          ))}
          <EntityPicker
            ariaLabel="Add entity reference"
            placeholder="Add entity…"
            exclude={board.entityRefs}
            onSelect={ref => save([...board.entityRefs, ref])}
          />
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

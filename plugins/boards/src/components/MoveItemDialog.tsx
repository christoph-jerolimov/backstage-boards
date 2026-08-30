import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Select,
  Text,
} from '@backstage/ui';
import { useApi } from '@backstage/frontend-plugin-api';
import { useQuery } from '@tanstack/react-query';
import {
  BoardItem,
  BoardWithContext,
  errorMessage,
  levelIncludes,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { ErrorText } from './common';

/**
 * Two-step move dialog: pick a target board (only boards the user can
 * write to), then one of its columns (loaded when the board is
 * chosen), then Move. The move carries the item with its full history
 * to the target and archives the original here.
 */
export function MoveItemDialog(props: {
  board: BoardWithContext;
  item: BoardItem;
  onClose: () => void;
  onMoved: () => Promise<void>;
}) {
  const { board, item, onClose, onMoved } = props;
  const boardsApi = useApi(boardsApiRef);
  const [targetBoardId, setTargetBoardId] = useState<string | undefined>();
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [moving, setMoving] = useState(false);

  const { data: listing } = useQuery({
    queryKey: [...queryKeys.boardsPage, 'move-targets'],
    queryFn: () => boardsApi.listBoards(),
  });
  const targets = (listing?.boards ?? []).filter(
    entry =>
      entry.id !== board.id &&
      !entry.archivedAt &&
      levelIncludes(entry.access, 'write'),
  );

  const { data: targetBoard } = useQuery({
    queryKey: queryKeys.board(targetBoardId ?? 'none'),
    enabled: !!targetBoardId,
    queryFn: () => boardsApi.getBoard(targetBoardId!),
  });
  const columns = targetBoard
    ? [...targetBoard.columns].sort((a, b) => a.position - b.position)
    : [];

  const move = async () => {
    if (!targetBoardId || !targetColumnId) {
      return;
    }
    setMoving(true);
    setError(undefined);
    try {
      await boardsApi.moveItemToBoard(board.id, item.id, {
        targetBoardId,
        targetColumnId,
      });
      await onMoved();
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
      setMoving(false);
    }
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()}>
      <DialogHeader>Move “{item.title}” to another board</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Text variant="body-small" color="secondary">
            The item moves with its comments and history; the original is
            archived on this board. Watches stay behind, and the priority
            carries over only when the target board has one with the same name.
          </Text>
          <Select
            label="Target board"
            placeholder={
              targets.length === 0
                ? 'No other board you can write to'
                : 'Choose a board'
            }
            isDisabled={targets.length === 0}
            options={targets.map(entry => ({
              value: entry.id,
              label: entry.name,
            }))}
            selectedKey={targetBoardId ?? null}
            onSelectionChange={key => {
              setTargetBoardId(String(key));
              setTargetColumnId(undefined);
            }}
          />
          {targetBoardId && (
            <Select
              label="Target column"
              placeholder={
                columns.length === 0 && targetBoard
                  ? 'This board has no columns'
                  : 'Choose a column'
              }
              isDisabled={columns.length === 0}
              options={columns.map(column => ({
                value: column.id,
                label: column.title,
              }))}
              selectedKey={targetColumnId ?? null}
              onSelectionChange={key => setTargetColumnId(String(key))}
            />
          )}
          {error && <ErrorText>{error}</ErrorText>}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Flex gap="2">
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!targetBoardId || !targetColumnId || moving}
            onPress={move}
          >
            Move
          </Button>
        </Flex>
      </DialogFooter>
    </Dialog>
  );
}

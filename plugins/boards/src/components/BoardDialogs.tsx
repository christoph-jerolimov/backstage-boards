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
import {
  BoardItem,
  BoardWithContext,
  RETENTION_DAYS,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ArchivedItemsDialog } from './ArchivedItemsDialog';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { DuplicateBoardDialog } from './DuplicateBoardDialog';
import { PriorityMatrixDialog } from './PriorityMatrixDialog';
import { RecentChangesDialog } from './RecentChangesDialog';
import { ShareDialog } from './ShareDialog';

/** The board page's dialogs; at most one of them is open at a time. */
export type BoardDialogKind =
  | 'settings'
  | 'share'
  | 'changes'
  | 'archived'
  | 'duplicate'
  | 'matrix'
  | 'delete';

/**
 * Every dialog the board page can open, mounted from the single
 * "which dialog is open" state.
 */
export function BoardDialogs(props: {
  board: BoardWithContext;
  /** The board's items after the active filters, for the matrix. */
  items: BoardItem[];
  canWrite: boolean;
  /** Archived boards are deleted for good instead of being archived. */
  archived: boolean;
  open?: BoardDialogKind;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onOpenItem: (itemId: string) => void;
  /** Runs after the board itself was deleted. */
  onDeleted: () => Promise<void> | void;
}) {
  const { board, items, canWrite, archived, open, onClose, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  // BUI dialogs report their own close; every kind closes the same way
  const openChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  return (
    <>
      <BoardSettingsDialog
        board={board}
        isOpen={open === 'settings'}
        onOpenChange={openChange}
        onChanged={onChanged}
      />

      <ShareDialog
        board={board}
        isOpen={open === 'share'}
        onOpenChange={openChange}
        onChanged={onChanged}
      />

      <RecentChangesDialog
        boardId={board.id}
        isOpen={open === 'changes'}
        onOpenChange={openChange}
        onOpenItem={props.onOpenItem}
      />

      <ArchivedItemsDialog
        boardId={board.id}
        canWrite={canWrite}
        isOpen={open === 'archived'}
        onOpenChange={openChange}
        onChanged={onChanged}
      />

      <DuplicateBoardDialog
        board={board}
        isOpen={open === 'duplicate'}
        onOpenChange={openChange}
      />

      <PriorityMatrixDialog
        board={board}
        items={items}
        isOpen={open === 'matrix'}
        onOpenChange={openChange}
        onOpenItem={props.onOpenItem}
      />

      <Dialog isOpen={open === 'delete'} onOpenChange={openChange}>
        <DialogHeader>
          {archived
            ? `Permanently delete “${board.name}”`
            : `Archive board “${board.name}”`}
        </DialogHeader>
        <DialogBody>
          <Text>
            {archived
              ? 'This permanently deletes the board with all items, comments, and history right now. This cannot be undone.'
              : `The board becomes read-only, disappears from all lists, and stays reachable for admins via its link. It is permanently deleted after ${RETENTION_DAYS} days.`}
          </Text>
        </DialogBody>
        <DialogFooter>
          <Flex gap="2">
            <Button variant="secondary" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              destructive
              onPress={async () => {
                if (archived) {
                  await boardsApi.hardDeleteBoard(board.id);
                } else {
                  await boardsApi.deleteBoard(board.id);
                }
                await props.onDeleted();
              }}
            >
              {archived ? 'Delete now' : 'Archive board'}
            </Button>
          </Flex>
        </DialogFooter>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Text,
  TextField,
} from '@backstage/ui';
import { BoardWithContext, levelIncludes } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';

/** Duplicates a board's structure; items are never copied. */
export function DuplicateBoardDialog(props: {
  board: BoardWithContext;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { board, isOpen, onOpenChange } = props;
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const isAdmin = levelIncludes(board.access, 'admin');
  const [name, setName] = useState(`${board.name} (copy)`);
  const [copyColumns, setCopyColumns] = useState(true);
  const [copyPermissions, setCopyPermissions] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const duplicate = async () => {
    setPending(true);
    setError(undefined);
    try {
      const copy = await boardsApi.duplicateBoard(board.id, {
        name: name.trim() || undefined,
        copyColumns,
        copyPermissions: isAdmin && copyPermissions,
      });
      onOpenChange(false);
      navigate(`../${copy.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Duplicate “{board.name}”</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <TextField
            label="Name of the copy"
            value={name}
            onChange={setName}
          />
          <Checkbox isSelected={copyColumns} onChange={setCopyColumns}>
            Copy columns (titles, order, colors)
          </Checkbox>
          {isAdmin && (
            <Checkbox
              isSelected={copyPermissions}
              onChange={setCopyPermissions}
            >
              Copy share settings (visibility and people/groups)
            </Checkbox>
          )}
          <Text variant="body-small" color="secondary">
            Items are not copied. You become an admin of the copy.
          </Text>
          {error && (
            <Text variant="body-small" style={{ color: '#cc3344' }}>
              {error}
            </Text>
          )}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Flex gap="2">
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" isPending={pending} onPress={duplicate}>
            Duplicate
          </Button>
        </Flex>
      </DialogFooter>
    </Dialog>
  );
}

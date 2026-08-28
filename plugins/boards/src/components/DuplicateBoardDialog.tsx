import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useRouteRef } from '@backstage/frontend-plugin-api';
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
import {
  BoardWithContext,
  levelIncludes,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { useAsyncAction } from './useAsyncAction';

/** Duplicates a board's structure and optionally its items. */
export function DuplicateBoardDialog(props: {
  board: BoardWithContext;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { board, isOpen, onOpenChange } = props;
  const boardsApi = useApi(boardsApiRef);
  const navigate = useNavigate();
  const rootLink = useRouteRef(rootRouteRef);
  const isAdmin = levelIncludes(board.access, 'admin');
  const [name, setName] = useState(`${board.name} (copy)`);
  const [copyColumns, setCopyColumnsState] = useState(true);
  const [copyItems, setCopyItems] = useState(false);
  const [copyEntities, setCopyEntities] = useState(false);
  const [copyPermissions, setCopyPermissions] = useState(false);

  const setCopyColumns = (value: boolean) => {
    setCopyColumnsState(value);
    if (!value) {
      // items can only be copied together with their columns
      setCopyItems(false);
    }
  };
  const { error, pending, run } = useAsyncAction();

  const duplicate = () =>
    run(async () => {
      const copy = await boardsApi.duplicateBoard(board.id, {
        name: name.trim() || undefined,
        copyColumns,
        copyItems: copyColumns && copyItems,
        copyEntities,
        copyPermissions: isAdmin && copyPermissions,
      });
      onOpenChange(false);
      navigate(`${rootLink?.() ?? '/boards'}/${copy.id}`);
    });

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Duplicate “{board.name}”</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <TextField label="Name of the copy" value={name} onChange={setName} />
          <Checkbox isSelected={copyColumns} onChange={setCopyColumns}>
            Copy columns (titles, order, colors)
          </Checkbox>
          <Checkbox
            isSelected={copyColumns && copyItems}
            isDisabled={!copyColumns}
            onChange={setCopyItems}
          >
            Copy items (titles, fields, assignees — no comments or history)
          </Checkbox>
          <Checkbox isSelected={copyEntities} onChange={setCopyEntities}>
            Copy entity references
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
            You become an admin of the copy.
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

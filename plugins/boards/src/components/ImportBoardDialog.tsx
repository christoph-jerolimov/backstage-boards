import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Text,
} from '@backstage/ui';
import { useApi } from '@backstage/frontend-plugin-api';
import { BoardDocument, errorMessage } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ErrorText } from './common';

/**
 * Imports a board JSON document (as produced by the export): pick a
 * file, see what it contains, and create a new board owned by you.
 */
export function ImportBoardDialog(props: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Runs with the created board's id. */
  onImported: (boardId: string) => void;
}) {
  const { isOpen, onOpenChange, onImported } = props;
  const boardsApi = useApi(boardsApiRef);
  const fileRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<BoardDocument | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [importing, setImporting] = useState(false);

  const readFile = async (file: File | undefined) => {
    setDocument(undefined);
    setError(undefined);
    if (!file) {
      return;
    }
    try {
      // File#text is missing in some environments (jsdom); FileReader
      // is universal
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      const parsed = JSON.parse(text);
      if (parsed?.format !== 'backstage-boards') {
        throw new Error('Not a backstage-boards export');
      }
      setDocument(parsed);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const importBoard = async () => {
    if (!document) {
      return;
    }
    setImporting(true);
    setError(undefined);
    try {
      const board = await boardsApi.importBoard(document);
      onOpenChange(false);
      onImported(board.id);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Import board</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Text variant="body-small" color="secondary">
            Pick a board JSON document (as produced by Export board). A new
            board owned by you is created with its columns, priorities,
            description, and items.
          </Text>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="Board document"
            onChange={event => readFile(event.target.files?.[0])}
          />
          {document && (
            <Text variant="body-small">
              “{document.board.name}” — {document.board.columns.length} columns,{' '}
              {document.items.length} items
            </Text>
          )}
          {error && <ErrorText>{error}</ErrorText>}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Flex gap="2">
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!document || importing}
            onPress={importBoard}
          >
            Import
          </Button>
        </Flex>
      </DialogFooter>
    </Dialog>
  );
}

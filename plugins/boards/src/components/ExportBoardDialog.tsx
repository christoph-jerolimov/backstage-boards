import { useState } from 'react';
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
import { BoardWithContext, errorMessage } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ErrorText } from './common';

/** Hands the browser a file to save. */
function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** A board name as a safe file name stem. */
function fileStem(name: string): string {
  return name.replaceAll(/[^\w-]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'board';
}

/**
 * Downloads the board as a portable JSON document (re-importable, and
 * the integration point for external converters) or its items as CSV.
 */
export function ExportBoardDialog(props: {
  board: BoardWithContext;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { board, isOpen, onOpenChange } = props;
  const boardsApi = useApi(boardsApiRef);
  const [error, setError] = useState<string | undefined>();

  const exportJson = async () => {
    try {
      const document = await boardsApi.exportBoard(board.id);
      download(
        `${fileStem(board.name)}.json`,
        'application/json',
        JSON.stringify(document, null, 2),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const exportCsv = async () => {
    try {
      const csv = await boardsApi.exportBoardCsv(board.id);
      download(`${fileStem(board.name)}.csv`, 'text/csv', csv);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Export “{board.name}”</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Text variant="body-small" color="secondary">
            The JSON document contains the board's columns, priorities,
            description, and items, and can be imported again from the boards
            page. The CSV holds one row per item for spreadsheets. Comments,
            history, and archived items are not exported.
          </Text>
          {error && <ErrorText>{error}</ErrorText>}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Flex gap="2">
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="secondary" onPress={exportCsv}>
            Download CSV
          </Button>
          <Button variant="primary" onPress={exportJson}>
            Download JSON
          </Button>
        </Flex>
      </DialogFooter>
    </Dialog>
  );
}

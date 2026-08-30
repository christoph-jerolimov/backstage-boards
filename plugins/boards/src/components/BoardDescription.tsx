import { useApi } from '@backstage/frontend-plugin-api';
import { BoardWithContext } from '@internal/plugin-boards-common';
import { useQueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { invalidateBoard, queryKeys } from '../queries';

import { EditableMarkdown } from './EditableMarkdown';

/**
 * The board's markdown description under the header: rendered for
 * everyone, edited in place by writers, with the same retained version
 * history the item description has.
 */
export function BoardDescription(props: {
  board: BoardWithContext;
  canWrite: boolean;
}) {
  const { board, canWrite } = props;
  const boardsApi = useApi(boardsApiRef);
  const queryClient = useQueryClient();
  return (
    <EditableMarkdown
      text={board.description ?? ''}
      canEdit={canWrite}
      versionCount={board.descriptionVersionCount}
      allowEmpty
      emptyText="Add a description: what this board is for, how the columns are used."
      editAriaLabel="Edit board description"
      loadVersions={() => boardsApi.listBoardDescriptionVersions(board.id)}
      versionsKey={queryKeys.boardDescriptionVersions(board.id)}
      onSave={async text => {
        await boardsApi.updateBoardDescription(board.id, text);
        await invalidateBoard(queryClient, board.id);
      }}
    />
  );
}

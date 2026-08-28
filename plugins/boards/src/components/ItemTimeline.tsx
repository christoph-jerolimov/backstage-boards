import { useApi } from '@backstage/frontend-plugin-api';
import { Flex, Text } from '@backstage/ui';
import { ItemComment, TimelineEntry } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { EditableMarkdown } from './EditableMarkdown';
import { changeSummary, formatDate, RefDisplay } from './common';

export function CommentBlock(props: {
  boardId: string;
  itemId: string;
  comment: ItemComment;
  canWrite: boolean;
  onChanged: () => Promise<void>;
}) {
  const { boardId, itemId, comment, canWrite, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);

  return (
    <div
      style={{
        border: '1px solid var(--bui-border-1)',
        borderRadius: 8,
        padding: 8,
      }}
    >
      <Text variant="body-small">
        <RefDisplay refString={comment.authorRef} /> commented{' '}
        {formatDate(comment.createdAt)}
        {comment.versionCount > 1 ? ' (edited)' : ''}
      </Text>
      <EditableMarkdown
        text={comment.text}
        canEdit={canWrite}
        versionCount={comment.versionCount}
        editAriaLabel="Edit comment"
        loadVersions={() =>
          boardsApi.listCommentVersions(boardId, itemId, comment.id)
        }
        versionsKey={queryKeys.commentVersions(boardId, itemId, comment.id)}
        onSave={async text => {
          await boardsApi.updateComment(boardId, itemId, comment.id, text);
          await onChanged();
        }}
      />
    </div>
  );
}

export function Timeline(props: {
  boardId: string;
  itemId: string;
  entries: TimelineEntry[];
  canWrite: boolean;
  onChanged: () => Promise<void>;
}) {
  return (
    <Flex direction="column" gap="2">
      {props.entries.map((entry, index) => {
        if (entry.kind === 'comment') {
          return (
            <CommentBlock
              key={`comment-${entry.comment.id}`}
              boardId={props.boardId}
              itemId={props.itemId}
              comment={entry.comment}
              canWrite={props.canWrite}
              onChanged={props.onChanged}
            />
          );
        }
        const { change } = entry;
        return (
          <Text key={`change-${index}`} variant="body-small" color="secondary">
            <RefDisplay refString={change.actorRef} /> {changeSummary(change)} ·{' '}
            {formatDate(change.at)}
          </Text>
        );
      })}
    </Flex>
  );
}

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Flex,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from '@backstage/ui';
import { ItemComment, TimelineEntry } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import {
  EditableMarkdown,
  formatDate,
  RefDisplay,
} from '@internal/plugin-boards-react';
import { changeSummary } from './common';

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
      {props.entries.map(entry => {
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
          <Text key={change.id} variant="body-small" color="secondary">
            <RefDisplay refString={change.actorRef} /> {changeSummary(change)} ·{' '}
            {formatDate(change.at)}
          </Text>
        );
      })}
    </Flex>
  );
}

type ActivityTab = 'combined' | 'comments' | 'changes';
type ActivityOrder = 'newest' | 'oldest';

/**
 * The tabbed view over an item's timeline: comments and changes combined
 * (the default), or either on its own, ordered newest first until the
 * toggle beside the tabs flips it. Filtering and ordering happen here on
 * the client; the server hands the timeline over oldest first. The
 * caller's comment composer renders inside the Combined and Comments
 * tabs, adjacent to where the new comment will appear: before the list
 * when newest first, after it when oldest first.
 */
export function ActivityBlock(props: {
  boardId: string;
  itemId: string;
  entries: TimelineEntry[];
  canWrite: boolean;
  onChanged: () => Promise<void>;
  composer?: ReactNode;
}) {
  const [tab, setTab] = useState<ActivityTab>('combined');
  const [order, setOrder] = useState<ActivityOrder>('newest');

  const visible = useMemo(() => {
    const filtered =
      tab === 'combined'
        ? props.entries
        : props.entries.filter(entry =>
            tab === 'comments'
              ? entry.kind === 'comment'
              : entry.kind === 'change',
          );
    // sorted rather than reversed, so an unsorted payload still lands right
    return [...filtered].sort((a, b) =>
      order === 'newest' ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at),
    );
  }, [props.entries, tab, order]);

  const list = (
    <Timeline
      boardId={props.boardId}
      itemId={props.itemId}
      entries={visible}
      canWrite={props.canWrite}
      onChanged={props.onChanged}
    />
  );

  const panel = (withComposer: boolean) => (
    <Flex direction="column" gap="2">
      {withComposer && order === 'newest' && props.composer}
      {list}
      {withComposer && order === 'oldest' && props.composer}
    </Flex>
  );

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={key => setTab(key as ActivityTab)}
    >
      <Flex align="center" justify="between" gap="2">
        <TabList aria-label="Activity view">
          <Tab id="combined">Combined</Tab>
          <Tab id="comments">Comments</Tab>
          <Tab id="changes">Changes</Tab>
        </TabList>
        <Button
          variant="tertiary"
          size="small"
          onPress={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}
        >
          {order === 'newest' ? 'Newest first' : 'Oldest first'}
        </Button>
      </Flex>
      <TabPanel id="combined">{panel(true)}</TabPanel>
      <TabPanel id="comments">{panel(true)}</TabPanel>
      <TabPanel id="changes">{panel(false)}</TabPanel>
    </Tabs>
  );
}

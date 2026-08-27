import { useEffect, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  ButtonIcon,
  Flex,
  Select,
  Text,
  TextAreaField,
  TextField,
} from '@backstage/ui';
import {
  BoardItem,
  BoardWithContext,
  isTextRef,
  ItemComment,
  TimelineEntry,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { AssigneeAvatars } from './AssigneeAvatars';
import { WatchButton } from './WatchButton';
import { DueDateBadge } from './DueDate';
import { EditableMarkdown } from './EditableMarkdown';
import { PrincipalPicker } from './PrincipalPicker';
import {
  changeSummary,
  formatDate,
  InlineEdit,
  RefDisplay,
  useAsyncData,
} from './common';
import { StatusBadge } from './StatusBadge';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function parseLabels(text: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const pair of text.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      labels[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return labels;
}

function parseList(text: string): string[] {
  return text
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function CommentBlock(props: {
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
        <RefDisplay refString={comment.authorRef} />{' '}
        commented {formatDate(comment.createdAt)}
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
        onSave={async text => {
          await boardsApi.updateComment(boardId, itemId, comment.id, text);
          await onChanged();
        }}
      />
    </div>
  );
}

function Timeline(props: {
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

export function ItemDrawer(props: {
  board: BoardWithContext;
  item: BoardItem;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { board, item, canWrite, onClose, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  const readonly = !canWrite || !!item.externalManager;
  const [newComment, setNewComment] = useState('');
  const [editLabels, setEditLabels] = useState(false);
  const [editTags, setEditTags] = useState(false);

  const {
    data: timeline,
    refresh: refreshTimeline,
  } = useAsyncData(
    () => boardsApi.getTimeline(board.id, item.id),
    [boardsApi, board.id, item.id, item.updatedAt],
  );

  const changed = async () => {
    await onChanged();
    await refreshTimeline();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    await boardsApi.addComment(board.id, item.id, text);
    setNewComment('');
    await changed();
  };

  return (
    <>
      {/* A plain (non-modal) overlay: Backstage UI popovers (menus,
          comboboxes) render in their own portal layer, and a modal
          overlay would swallow their pointer events. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events -- backdrop click-to-close; Escape handled globally */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 900,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
        role="dialog"
        aria-label={`Item ${item.title}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 901,
          width: 'min(560px, 90vw)',
          background: 'var(--bui-bg-neutral-1)',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          outline: 'none',
          padding: 16,
        }}
      >
          <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="2">
              <InlineEdit
                value={item.title}
                canEdit={!readonly}
                ariaLabel="item title"
                onCommit={async title => {
                  await boardsApi.updateItem(board.id, item.id, { title });
                  await changed();
                }}
                display={
                  <Text variant="title-small" as="h2">
                    {item.title}
                  </Text>
                }
              />
              <ButtonIcon
                aria-label="Close item details"
                variant="tertiary"
                icon={<CloseIcon />}
                onPress={onClose}
              />
            </Flex>

            {item.externalManager && (
              <Text variant="body-small" color="secondary">
                This item is managed by “{item.externalManager}” and read-only.
              </Text>
            )}

            <div>
              <Text variant="body-small" color="secondary">
                Description
              </Text>
              <EditableMarkdown
                text={item.description ?? ''}
                canEdit={!readonly}
                versionCount={item.descriptionVersionCount}
                allowEmpty
                emptyText="No description yet."
                editAriaLabel="Edit description"
                loadVersions={() =>
                  boardsApi.listDescriptionVersions(board.id, item.id)
                }
                onSave={async text => {
                  await boardsApi.updateItem(board.id, item.id, {
                    description: text,
                  });
                  await changed();
                }}
              />
            </div>

            <Flex align="center" gap="2">
              <StatusBadge
                column={board.columns.find(
                  column => column.id === item.columnId,
                )}
              />
            </Flex>
            <Select
              label="Status"
              isDisabled={readonly}
              options={board.columns.map(column => ({
                value: column.id,
                label: column.title,
              }))}
              selectedKey={item.columnId}
              onSelectionChange={async key => {
                if (key && String(key) !== item.columnId) {
                  await boardsApi.moveItem(board.id, item.id, {
                    columnId: String(key),
                  });
                  await changed();
                }
              }}
            />

            <div>
              <Text variant="body-small" color="secondary">
                Due date
              </Text>
              <Flex align="center" gap="2">
                {item.dueDate ? (
                  <DueDateBadge dueDate={item.dueDate} />
                ) : (
                  <Text variant="body-small" color="secondary">
                    No due date
                  </Text>
                )}
                {!readonly && (
                  <input
                    type="date"
                    aria-label="Due date"
                    value={item.dueDate ?? ''}
                    onChange={async event => {
                      const value = event.target.value;
                      await boardsApi.updateItem(board.id, item.id, {
                        dueDate: value === '' ? null : value,
                      });
                      await changed();
                    }}
                    style={{
                      background: 'var(--bui-bg-neutral-1)',
                      color: 'inherit',
                      border: '1px solid var(--bui-border-1)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      font: 'inherit',
                    }}
                  />
                )}
                {!readonly && item.dueDate && (
                  <Button
                    variant="tertiary"
                    size="small"
                    onPress={async () => {
                      await boardsApi.updateItem(board.id, item.id, {
                        dueDate: null,
                      });
                      await changed();
                    }}
                  >
                    Clear
                  </Button>
                )}
              </Flex>
            </div>

            <div>
              <Text variant="body-small" color="secondary">
                Assignees
              </Text>
              <Flex direction="column" gap="2">
                {item.assignees.length > 0 ? (
                  <Flex gap="1" align="center" style={{ flexWrap: 'wrap' }}>
                    {item.assignees.map(assignee => (
                      <span
                        key={assignee}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          border: '1px solid var(--bui-border-1)',
                          borderRadius: 12,
                          padding: '2px 4px 2px 8px',
                        }}
                      >
                        {isTextRef(assignee) ? (
                          <RefDisplay refString={assignee} />
                        ) : (
                          <AssigneeAvatars refs={[assignee]} />
                        )}
                        {!readonly && (
                          <Button
                            variant="tertiary"
                            size="small"
                            aria-label={`Remove assignee ${assignee}`}
                            onPress={async () => {
                              await boardsApi.updateItem(board.id, item.id, {
                                assignees: item.assignees.filter(
                                  ref => ref !== assignee,
                                ),
                              });
                              await changed();
                            }}
                          >
                            ✕
                          </Button>
                        )}
                      </span>
                    ))}
                  </Flex>
                ) : (
                  <Text variant="body-small" color="secondary">
                    Unassigned
                  </Text>
                )}
                {!readonly && (
                  <PrincipalPicker
                    ariaLabel="Add assignee"
                    placeholder="Add assignee…"
                    allowText
                    exclude={item.assignees}
                    onSelect={async ref => {
                      await boardsApi.updateItem(board.id, item.id, {
                        assignees: [...item.assignees, ref],
                      });
                      await changed();
                    }}
                  />
                )}
              </Flex>
            </div>

            <div>
              <Text variant="body-small" color="secondary">
                Labels
              </Text>
              {editLabels ? (
                <TextField
                  aria-label="Labels (key=value, comma separated)"
                  description="Comma-separated key=value pairs, e.g. priority=high, env=prod"
                  defaultValue={Object.entries(item.labels)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(', ')}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
                  autoFocus
                  onBlur={async event => {
                    setEditLabels(false);
                    await boardsApi.updateItem(board.id, item.id, {
                      labels: parseLabels(event.target.value),
                    });
                    await changed();
                  }}
                />
              ) : (
                <Flex align="center" gap="2">
                  <Text variant="body-small">
                    {Object.entries(item.labels)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(', ') || '—'}
                  </Text>
                  {!readonly && (
                    <Button
                      variant="tertiary"
                      size="small"
                      onPress={() => setEditLabels(true)}
                    >
                      Edit
                    </Button>
                  )}
                </Flex>
              )}
            </div>

            <div>
              <Text variant="body-small" color="secondary">
                Tags
              </Text>
              {editTags ? (
                <TextField
                  aria-label="Tags (comma separated)"
                  defaultValue={item.tags.join(', ')}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
                  autoFocus
                  onBlur={async event => {
                    setEditTags(false);
                    await boardsApi.updateItem(board.id, item.id, {
                      tags: parseList(event.target.value),
                    });
                    await changed();
                  }}
                />
              ) : (
                <Flex align="center" gap="2">
                  <Text variant="body-small">
                    {item.tags.join(', ') || '—'}
                  </Text>
                  {!readonly && (
                    <Button
                      variant="tertiary"
                      size="small"
                      onPress={() => setEditTags(true)}
                    >
                      Edit
                    </Button>
                  )}
                </Flex>
              )}
            </div>

            <Flex direction="column" gap="1">
              <Text variant="body-x-small" color="secondary">
                Created by <RefDisplay refString={item.createdBy} /> at{' '}
                {formatDate(item.createdAt)}
              </Text>
              {item.creatorRef && (
                <Text variant="body-x-small" color="secondary">
                  Creator: <RefDisplay refString={item.creatorRef} />
                </Text>
              )}
              <Text variant="body-x-small" color="secondary">
                Updated by <RefDisplay refString={item.updatedBy} /> at{' '}
                {formatDate(item.updatedAt)}
              </Text>
            </Flex>

            <Flex align="center" gap="2" justify="between">
              <WatchButton
                watching={!!item.watching}
                targetLabel="this item"
                onToggle={async watching => {
                  await boardsApi.setWatchItem(board.id, item.id, watching);
                  await onChanged();
                }}
                loadWatchers={() =>
                  boardsApi.listItemWatchers(board.id, item.id)
                }
              />
              {!readonly && (
                <Button
                  variant="secondary"
                  size="small"
                  destructive
                  onPress={async () => {
                    await boardsApi.deleteItem(board.id, item.id);
                    onClose();
                    await onChanged();
                  }}
                >
                  Delete item
                </Button>
              )}
            </Flex>

            <Text variant="body-medium" weight="bold" as="h3">
              Activity
            </Text>
            {timeline && (
              <Timeline
                boardId={board.id}
                itemId={item.id}
                entries={timeline}
                canWrite={canWrite}
                onChanged={changed}
              />
            )}
            {canWrite && (
              <Flex direction="column" gap="2">
                <TextAreaField
                  aria-label="New comment"
                  placeholder="Write a comment… (markdown subset, entity refs like system:default/example auto-link)"
                  value={newComment}
                  onChange={setNewComment}
                />
                <div>
                  <Button variant="primary" size="small" onPress={addComment}>
                    Comment
                  </Button>
                </div>
              </Flex>
            )}
          </Flex>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { RiCloseLine } from '@remixicon/react';
import {
  Button,
  ButtonIcon,
  Flex,
  Select,
  Text,
  TextAreaField,
} from '@backstage/ui';
import {
  BoardItem,
  BoardWithContext,
  ItemUpdate,
} from '@internal/plugin-boards-common';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { WatchButton } from './WatchButton';
import { EditableMarkdown } from './EditableMarkdown';
import {
  AssigneesField,
  DrawerField,
  DueDateField,
  ItemMetadata,
} from './ItemDrawerFields';
import { Timeline } from './ItemTimeline';
import { TagsEditor } from './TagsEditor';
import { InlineEdit } from './common';
import { PriorityChip, StatusBadge } from './StatusBadge';

export function ItemDrawer(props: {
  board: BoardWithContext;
  item: BoardItem;
  canWrite: boolean;
  /** Tags used on the board, offered as suggestions when adding. */
  tagSuggestions?: string[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { board, item, canWrite, onClose, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  const readonly = !canWrite || !!item.externalManager;
  const [newComment, setNewComment] = useState('');

  const queryClient = useQueryClient();
  const timelineKey = queryKeys.timeline(board.id, item.id);
  const { data: timeline } = useQuery({
    queryKey: timelineKey,
    queryFn: () => boardsApi.getTimeline(board.id, item.id),
  });

  const changed = async () => {
    await onChanged();
    await queryClient.invalidateQueries({ queryKey: timelineKey });
  };

  /** Saves one or more item fields and refreshes what the drawer shows. */
  const patchItem = async (update: ItemUpdate) => {
    await boardsApi.updateItem(board.id, item.id, update);
    await changed();
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
              onCommit={title => patchItem({ title })}
              display={
                <Text variant="title-small" as="h2">
                  {item.title}
                </Text>
              }
            />
            <ButtonIcon
              aria-label="Close item details"
              variant="tertiary"
              icon={<RiCloseLine size={16} />}
              onPress={onClose}
            />
          </Flex>

          {item.externalManager && (
            <Text variant="body-small" color="secondary">
              This item is managed by “{item.externalManager}” and read-only.
            </Text>
          )}

          <Flex align="center" gap="2" justify="between">
            <WatchButton
              watching={!!item.watching}
              targetLabel="this item"
              onToggle={async watching => {
                await boardsApi.setWatchItem(board.id, item.id, watching);
                await onChanged();
              }}
              loadWatchers={() => boardsApi.listItemWatchers(board.id, item.id)}
              watchersKey={queryKeys.itemWatchers(board.id, item.id)}
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

          <Flex align="center" gap="2">
            <StatusBadge
              column={board.columns.find(column => column.id === item.columnId)}
            />
            <PriorityChip
              priority={board.priorities.find(
                priority => priority.id === item.priorityId,
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

          {board.priorities.length > 0 && (
            <Select
              label="Priority"
              isDisabled={readonly}
              options={[
                { value: 'none', label: 'None' },
                ...[...board.priorities]
                  .sort((a, b) => a.order - b.order)
                  .map(priority => ({
                    value: priority.id,
                    label: priority.name,
                  })),
              ]}
              selectedKey={item.priorityId ?? 'none'}
              onSelectionChange={async key => {
                const next = key && String(key) !== 'none' ? String(key) : null;
                if ((next ?? 'none') !== (item.priorityId ?? 'none')) {
                  await patchItem({ priorityId: next });
                }
              }}
            />
          )}

          <DueDateField
            dueDate={item.dueDate}
            readonly={readonly}
            onChange={dueDate => patchItem({ dueDate })}
          />

          <AssigneesField
            assignees={item.assignees}
            readonly={readonly}
            onChange={assignees => patchItem({ assignees })}
          />

          <DrawerField label="Description">
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
              versionsKey={queryKeys.descriptionVersions(board.id, item.id)}
              onSave={description => patchItem({ description })}
            />
          </DrawerField>

          <DrawerField label="Tags">
            <TagsEditor
              tags={item.tags}
              canEdit={!readonly}
              suggestions={props.tagSuggestions ?? []}
              onChange={tags => patchItem({ tags })}
            />
          </DrawerField>

          <ItemMetadata item={item} />

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

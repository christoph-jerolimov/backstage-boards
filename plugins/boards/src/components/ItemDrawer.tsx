import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { RiCloseLine } from '@remixicon/react';
import {
  Box,
  Button,
  ButtonIcon,
  Flex,
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
import { queryKeys, useItemsQuery, useMoveItem } from '../queries';
import { WatchButton } from './WatchButton';
import { EditableMarkdown } from './EditableMarkdown';
import { AssigneesField, DrawerSection } from './ItemDrawerFields';
import { useDraft } from './drafts';
import { ActivityBlock } from './ItemTimeline';
import { ChecklistEditor } from './ChecklistEditor';
import { TagsEditor } from './TagsEditor';
import { ErrorText, InlineEdit } from './common';
import {
  DueDateSelect,
  PrioritySelect,
  StatusBadgeSelect,
} from './ItemBadgeSelects';
import { ItemActions, ItemMenu } from './ItemMenu';
import { RowActionsMenu } from './RowMenu';
import { assigneePool } from './grouping';

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
  // unsent input survives closing the drawer and reloading the browser
  const [newComment, setNewComment, clearNewComment] = useDraft(
    `comment-${board.id}-${item.id}`,
  );
  const [descriptionDraft, setDescriptionDraft, clearDescriptionDraft] =
    useDraft(`description-${board.id}-${item.id}`);
  const [actionError, setActionError] = useState<string>();

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

  const moveItemMutation = useMoveItem(board.id, setActionError);
  /** Optimistic status change: the badge flips before the server answers. */
  const moveTo = async (columnId: string) => {
    try {
      await moveItemMutation.mutateAsync({ itemId: item.id, columnId });
    } catch {
      return; // rolled back; the mutation surfaced the error already
    }
    await changed();
  };

  // The board's items, for offering its assignees in the menu; shares the
  // board page's cache, so the drawer costs no extra request there.
  const { data: boardItems } = useItemsQuery(board.id);
  const pool = useMemo(
    () => assigneePool(boardItems ?? [item]),
    [boardItems, item],
  );

  const itemActions: ItemActions = {
    // the details are already open; the menu drops its entry for this
    openItem: () => {},
    moveItem: (_itemId, target) => moveTo(target.columnId),
    setItemDueDate: (_itemId, dueDate) => patchItem({ dueDate }),
    setAssignees: (_itemId, assignees) => patchItem({ assignees }),
    setItemPriority: (_itemId, priorityId) => patchItem({ priorityId }),
    deleteItem: async () => {
      await boardsApi.deleteItem(board.id, item.id);
      onClose();
      await onChanged();
    },
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
    clearNewComment();
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
      {/* A Box, so nested BUI fields know their surface: they draw
          themselves in the next neutral shade instead of vanishing
          into the drawer's own background. */}
      <Box
        role="dialog"
        aria-label={`Item ${item.title}`}
        bg="neutral"
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
            <Flex align="center" gap="1">
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
                watchersKey={queryKeys.itemWatchers(board.id, item.id)}
              />
              {!readonly && (
                <RowActionsMenu label={`Actions for ${item.title}`}>
                  <ItemMenu
                    item={item}
                    columns={board.columns}
                    priorities={board.priorities}
                    readonly={readonly}
                    actions={itemActions}
                    assigneePool={pool}
                    showOpenDetails={false}
                  />
                </RowActionsMenu>
              )}
              <ButtonIcon
                aria-label="Close item details"
                variant="tertiary"
                icon={<RiCloseLine size={16} />}
                onPress={onClose}
              />
            </Flex>
          </Flex>

          {item.externalManager && (
            <Text variant="body-small" color="secondary">
              This item is managed by “{item.externalManager}” and read-only.
            </Text>
          )}

          {actionError && <ErrorText>{actionError}</ErrorText>}

          <DrawerSection title="Details">
            <Flex align="center" gap="2">
              <StatusBadgeSelect
                columns={board.columns}
                columnId={item.columnId}
                readonly={readonly}
                onSelect={moveTo}
              />
              {board.priorities.length > 0 && (
                <PrioritySelect
                  priorities={board.priorities}
                  priorityId={item.priorityId}
                  readonly={readonly}
                  onSelect={priorityId => patchItem({ priorityId })}
                />
              )}
              <DueDateSelect
                dueDate={item.dueDate}
                readonly={readonly}
                onChange={dueDate => patchItem({ dueDate })}
              />
            </Flex>

            {/* borderless label/value table for the list-shaped fields */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                columnGap: 16,
                rowGap: 8,
                alignItems: 'baseline',
              }}
            >
              <Text variant="body-small" color="secondary">
                Assignees
              </Text>
              <AssigneesField
                assignees={item.assignees}
                readonly={readonly}
                onChange={assignees => patchItem({ assignees })}
              />
              <Text variant="body-small" color="secondary">
                Tags
              </Text>
              <TagsEditor
                tags={item.tags}
                canEdit={!readonly}
                suggestions={props.tagSuggestions ?? []}
                onChange={tags => patchItem({ tags })}
              />
            </div>
          </DrawerSection>

          <EditableMarkdown
            title={
              <Text variant="body-medium" weight="bold" as="h3">
                Description
              </Text>
            }
            text={item.description ?? ''}
            canEdit={!readonly}
            versionCount={item.descriptionVersionCount}
            allowEmpty
            emptyText="No description yet."
            editAriaLabel="Edit description"
            draft={descriptionDraft || undefined}
            onDraftChange={text =>
              text === null
                ? clearDescriptionDraft()
                : setDescriptionDraft(text)
            }
            loadVersions={() =>
              boardsApi.listDescriptionVersions(board.id, item.id)
            }
            versionsKey={queryKeys.descriptionVersions(board.id, item.id)}
            onSave={description => patchItem({ description })}
          />

          <DrawerSection title="Checklist">
            <ChecklistEditor
              checklist={item.checklist}
              canEdit={!readonly}
              onChange={checklist => patchItem({ checklist })}
            />
          </DrawerSection>

          {timeline && (
            <ActivityBlock
              boardId={board.id}
              itemId={item.id}
              entries={timeline}
              canWrite={canWrite}
              onChanged={changed}
              composer={
                canWrite ? (
                  <Flex direction="column" gap="2">
                    <TextAreaField
                      aria-label="New comment"
                      placeholder="Write a comment… (markdown subset, entity refs like system:default/example auto-link)"
                      value={newComment}
                      onChange={setNewComment}
                    />
                    <div>
                      <Button
                        variant="primary"
                        size="small"
                        onPress={addComment}
                      >
                        Comment
                      </Button>
                    </div>
                  </Flex>
                ) : undefined
              }
            />
          )}
        </Flex>
      </Box>
    </>
  );
}

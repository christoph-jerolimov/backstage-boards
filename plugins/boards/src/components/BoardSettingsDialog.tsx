import { useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  ButtonIcon,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Select,
  Text,
  TextField,
} from '@backstage/ui';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiPaletteLine,
} from '@remixicon/react';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import {
  ALL_COLUMN_COLORS,
  BoardPriority,
  BoardWithContext,
  MAX_PRIORITIES,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ErrorText, InlineEdit, selectedOption } from './common';
import { EntityPicker } from './EntityPicker';
import { ColorDot } from './StatusBadge';
import { useAsyncAction } from './useAsyncAction';

/** One priority row: order number, name, color, reorder and delete. */
function PriorityRow(props: {
  priority: BoardPriority;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onColor: (color: string | null) => void;
  onMove: (order: number) => void;
  onDelete: () => void;
}) {
  const { priority, isFirst, isLast } = props;
  return (
    <Flex align="center" gap="2" justify="between">
      <Flex align="center" gap="2" style={{ minWidth: 0, flexGrow: 1 }}>
        <Text variant="body-small" color="secondary">
          {priority.order}
        </Text>
        <ColorDot color={priority.color} size={10} />
        <InlineEdit
          value={priority.name}
          canEdit
          ariaLabel={`priority ${priority.name} name`}
          onCommit={props.onRename}
          display={<Text variant="body-small">{priority.name}</Text>}
        />
      </Flex>
      <Flex align="center" gap="1">
        <ButtonIcon
          aria-label={`Move priority ${priority.name} up`}
          variant="tertiary"
          size="small"
          isDisabled={isFirst}
          icon={<RiArrowUpLine size={16} />}
          onPress={() => props.onMove(priority.order - 1)}
        />
        <ButtonIcon
          aria-label={`Move priority ${priority.name} down`}
          variant="tertiary"
          size="small"
          isDisabled={isLast}
          icon={<RiArrowDownLine size={16} />}
          onPress={() => props.onMove(priority.order + 1)}
        />
        <MenuTrigger>
          <ButtonIcon
            aria-label={`Color of priority ${priority.name}`}
            variant="tertiary"
            size="small"
            icon={<RiPaletteLine size={16} />}
          />
          <Menu aria-label={`Color of priority ${priority.name}`}>
            {ALL_COLUMN_COLORS.map(color => (
              <MenuItem key={color} onAction={() => props.onColor(color)}>
                <Flex align="center" gap="2">
                  <ColorDot color={color} size={8} />
                  <span>{color}</span>
                </Flex>
              </MenuItem>
            ))}
            <MenuItem onAction={() => props.onColor(null)}>No color</MenuItem>
          </Menu>
        </MenuTrigger>
        <Button
          variant="tertiary"
          size="small"
          aria-label={`Delete priority ${priority.name}`}
          onPress={props.onDelete}
        >
          Delete
        </Button>
      </Flex>
    </Flex>
  );
}

/**
 * The choice a delete of a still-used priority requires: reassign every
 * affected item to another priority, or drop the priority from them.
 */
function DeleteUsedPriority(props: {
  priority: BoardPriority;
  others: BoardPriority[];
  onReassign: (targetId: string) => void;
  onDrop: () => void;
  onCancel: () => void;
}) {
  const { priority, others } = props;
  const [target, setTarget] = useState<string | undefined>(others[0]?.id);
  const ids = others.map(other => other.id);
  return (
    <Flex direction="column" gap="2">
      <Text variant="body-small">
        “{priority.name}” is still used by items. Reassign them to another
        priority or remove the priority from them.
      </Text>
      {others.length > 0 && (
        <Flex align="center" gap="2">
          <Select
            aria-label="Reassign items to"
            size="small"
            options={others.map(other => ({
              value: other.id,
              label: other.name,
            }))}
            selectedKey={target}
            onSelectionChange={key => setTarget(selectedOption(key, ids))}
          />
          <Button
            variant="secondary"
            size="small"
            isDisabled={!target}
            onPress={() => target && props.onReassign(target)}
          >
            Reassign and delete
          </Button>
        </Flex>
      )}
      <Flex align="center" gap="2">
        <Button
          variant="secondary"
          size="small"
          destructive
          onPress={props.onDrop}
        >
          Remove priority from items and delete
        </Button>
        <Button variant="tertiary" size="small" onPress={props.onCancel}>
          Cancel
        </Button>
      </Flex>
    </Flex>
  );
}

/** The board's priority definitions, managed inline like the entity list. */
function PrioritiesSection(props: {
  board: BoardWithContext;
  run: (action: () => Promise<void>) => Promise<string | undefined>;
}) {
  const { board, run } = props;
  const boardsApi = useApi(boardsApiRef);
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<
    BoardPriority | undefined
  >();

  const priorities = [...board.priorities].sort((a, b) => a.order - b.order);
  const full = priorities.length >= MAX_PRIORITIES;

  const add = async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    await run(async () => {
      await boardsApi.addPriority(board.id, { name });
      setNewName('');
    });
  };

  const remove = async (priority: BoardPriority) => {
    const failure = await run(() =>
      boardsApi.deletePriority(board.id, priority.id),
    );
    if (failure?.includes('still used')) {
      setPendingDelete(priority);
    }
  };

  return (
    <Flex direction="column" gap="2">
      <Text variant="body-medium" weight="bold" as="h3">
        Priorities
      </Text>
      <Text variant="body-small" color="secondary">
        Up to {MAX_PRIORITIES} priorities, highest first; items reference them
        by id, so renaming is safe.
      </Text>
      {priorities.length === 0 && (
        <Text variant="body-small" color="secondary">
          No priorities defined; items cannot be prioritized.
        </Text>
      )}
      {priorities.map(priority =>
        pendingDelete?.id === priority.id ? (
          <DeleteUsedPriority
            key={priority.id}
            priority={priority}
            others={priorities.filter(other => other.id !== priority.id)}
            onReassign={async targetId => {
              await run(() =>
                boardsApi.deletePriority(board.id, priority.id, {
                  reassignTo: targetId,
                }),
              );
              setPendingDelete(undefined);
            }}
            onDrop={async () => {
              await run(() =>
                boardsApi.deletePriority(board.id, priority.id, {
                  drop: true,
                }),
              );
              setPendingDelete(undefined);
            }}
            onCancel={() => setPendingDelete(undefined)}
          />
        ) : (
          <PriorityRow
            key={priority.id}
            priority={priority}
            isFirst={priority.order === 1}
            isLast={priority.order === priorities.length}
            onRename={name =>
              run(async () => {
                await boardsApi.updatePriority(board.id, priority.id, {
                  name,
                });
              })
            }
            onColor={color =>
              run(async () => {
                await boardsApi.updatePriority(board.id, priority.id, {
                  color: color as BoardPriority['color'] | null,
                });
              })
            }
            onMove={order =>
              run(async () => {
                await boardsApi.updatePriority(board.id, priority.id, {
                  order,
                });
              })
            }
            onDelete={() => remove(priority)}
          />
        ),
      )}
      <Flex align="center" gap="2">
        <TextField
          aria-label="New priority name"
          placeholder={full ? `At most ${MAX_PRIORITIES} priorities` : 'Add priority…'}
          value={newName}
          onChange={setNewName}
          isDisabled={full}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button
          variant="secondary"
          size="small"
          isDisabled={full || !newName.trim()}
          onPress={add}
        >
          Add
        </Button>
      </Flex>
    </Flex>
  );
}

/**
 * Board settings: manage the list of catalog entities the board
 * references and the board's priorities. Changes are saved immediately.
 */
export function BoardSettingsDialog(props: {
  board: BoardWithContext;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const { board, isOpen, onOpenChange, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  const { error, run } = useAsyncAction();

  /** Runs a settings mutation, refreshing the board after it. */
  const runAndRefresh = (action: () => Promise<void>) =>
    run(async () => {
      await action();
      await onChanged();
    });

  const save = (entityRefs: string[]) =>
    runAndRefresh(async () => {
      await boardsApi.updateBoard(board.id, { entityRefs });
    });

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Board settings</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Text variant="body-small" color="secondary">
            Referenced catalog entities, e.g. a component and the owning team.
          </Text>
          {error && <ErrorText>{error}</ErrorText>}
          {board.entityRefs.length === 0 && (
            <Text variant="body-small" color="secondary">
              No entities referenced yet.
            </Text>
          )}
          {board.entityRefs.map(ref => (
            <Flex key={ref} align="center" gap="2" justify="between">
              <Text variant="body-small">
                <EntityRefLink entityRef={ref} />
              </Text>
              <Button
                variant="tertiary"
                size="small"
                aria-label={`Remove entity ${ref}`}
                onPress={() =>
                  save(board.entityRefs.filter(entry => entry !== ref))
                }
              >
                Remove
              </Button>
            </Flex>
          ))}
          <EntityPicker
            ariaLabel="Add entity reference"
            placeholder="Add entity…"
            exclude={board.entityRefs}
            onSelect={ref => save([...board.entityRefs, ref])}
          />
          <PrioritiesSection board={board} run={runAndRefresh} />
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

import { useMemo } from 'react';
import { Dialog, DialogBody, DialogHeader, Text } from '@backstage/ui';
import {
  BoardItem,
  BoardWithContext,
  isTextRef,
  refDisplayName,
} from '@internal/plugin-boards-common';
import { groupItems, REST_KEY, REST_LABEL } from './grouping';
import { MatrixRow, MatrixTable } from './MatrixTable';
import { useProfiles } from './useProfiles';

/**
 * The status × assignee matrix: one column per board column, one row per
 * assignee carrying an item, plus a trailing "Unassigned" row when items
 * without an assignee exist. An item with several assignees counts in
 * each of their rows, so the overall total can exceed the item count.
 */
export function AssigneeMatrixDialog(props: {
  board: BoardWithContext;
  /** The board's items, already narrowed by the active filters. */
  items: BoardItem[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { board, items, isOpen, onOpenChange } = props;

  // the grouping the assignee swimlanes use, so both agree on who has
  // items, how they sort, and where unassigned items land
  const groups = useMemo(() => groupItems(items, 'assignee'), [items]);
  const profiles = useProfiles(
    useMemo(
      () =>
        groups
          .map(group => group.key)
          .filter(key => key !== REST_KEY.assignee && !isTextRef(key)),
      [groups],
    ),
  );

  const rows: MatrixRow[] = groups.map(group =>
    group.key === REST_KEY.assignee
      ? {
          key: group.key,
          name: REST_LABEL.assignee,
          matches: (item: BoardItem) => item.assignees.length === 0,
        }
      : {
          key: group.key,
          // the name the filter bar and the card avatars show
          name:
            profiles.get(group.key)?.displayName ?? refDisplayName(group.key),
          title: group.key,
          matches: (item: BoardItem) => item.assignees.includes(group.key),
        },
  );

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      style={{ width: '800px', maxWidth: '95%' }}
    >
      <DialogHeader>Assignee matrix</DialogHeader>
      <DialogBody>
        <Text variant="body-small" color="secondary">
          Click a status or assignee badge to leave it out of the sums. An item
          with several assignees counts for each of them.
        </Text>
        <MatrixTable
          columns={board.columns}
          items={items}
          rows={rows}
          label="Assignee matrix"
          rowHeaderLabel="Assignee"
        />
      </DialogBody>
    </Dialog>
  );
}

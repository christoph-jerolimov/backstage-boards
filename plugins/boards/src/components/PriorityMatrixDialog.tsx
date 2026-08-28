import { Dialog, DialogBody, DialogHeader, Text } from '@backstage/ui';
import { BoardItem, BoardWithContext } from '@internal/plugin-boards-common';
import { NO_PRIORITY, REST_LABEL } from './grouping';
import { MatrixRow, MatrixTable } from './MatrixTable';

/**
 * The status × priority matrix: one column per board column, one row per
 * priority (order 1 first) plus a trailing "No priority" row when items
 * without one exist. Cells show the count of matching items; a sum
 * column, a sum row, and an overall total aggregate the combinations
 * whose status and priority badges are selected.
 */
export function PriorityMatrixDialog(props: {
  board: BoardWithContext;
  /** The board's items, already narrowed by the active filters. */
  items: BoardItem[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { board, items, isOpen, onOpenChange } = props;

  const priorities = [...board.priorities].sort((a, b) => a.order - b.order);
  const rows: MatrixRow[] = [
    ...priorities.map(priority => ({
      key: priority.id,
      name: priority.name,
      color: priority.color,
      matches: (item: BoardItem) => item.priorityId === priority.id,
    })),
    ...(items.some(item => !item.priorityId)
      ? [
          {
            key: NO_PRIORITY,
            name: REST_LABEL.priority,
            matches: (item: BoardItem) => !item.priorityId,
          },
        ]
      : []),
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      style={{ width: '800px', maxWidth: '95%' }}
    >
      <DialogHeader>Priority matrix</DialogHeader>
      <DialogBody>
        <Text variant="body-small" color="secondary">
          Click a status or priority badge to leave it out of the sums.
        </Text>
        <MatrixTable
          columns={board.columns}
          items={items}
          rows={rows}
          label="Priority matrix"
          rowHeaderLabel="Priority"
        />
      </DialogBody>
    </Dialog>
  );
}

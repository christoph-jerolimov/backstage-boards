import { useState } from 'react';
import { Dialog, DialogBody, DialogHeader, Text } from '@backstage/ui';
import { BoardItem, BoardWithContext } from '@internal/plugin-boards-common';
import { NO_PRIORITY, REST_LABEL } from './grouping';
import { StatusChip } from './StatusBadge';

/** One row of the matrix: a priority, or the trailing no-priority rest. */
type MatrixRow = {
  key: string;
  name: string;
  color?: React.ComponentProps<typeof StatusChip>['color'];
  matches: (item: BoardItem) => boolean;
};

/** Toggles `key` in `set`, returning a new set. */
function toggled(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

/**
 * A header badge that toggles its status/priority in and out of the
 * sums. Everything starts selected; an unselected badge dims but its
 * cells keep their counts.
 */
function ToggleBadge(props: {
  label: string;
  color?: React.ComponentProps<typeof StatusChip>['color'];
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onToggle}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        opacity: props.selected ? 1 : 0.4,
      }}
    >
      <StatusChip color={props.color}>{props.label}</StatusChip>
    </button>
  );
}

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
  // stored as the *unselected* sets, so the default is everything selected
  const [unselectedStatuses, setUnselectedStatuses] = useState(
    new Set<string>(),
  );
  const [unselectedRows, setUnselectedRows] = useState(new Set<string>());

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

  const count = (columnId: string, row: MatrixRow) =>
    items.filter(item => item.columnId === columnId && row.matches(item))
      .length;
  const statusSelected = (columnId: string) =>
    !unselectedStatuses.has(columnId);
  const rowSelected = (row: MatrixRow) => !unselectedRows.has(row.key);
  // every sum counts only combinations whose status AND priority are
  // selected, so an unselected axis reads 0 in its own sum too
  const rowSum = (row: MatrixRow) =>
    rowSelected(row)
      ? board.columns
          .filter(column => statusSelected(column.id))
          .reduce((sum, column) => sum + count(column.id, row), 0)
      : 0;
  const columnSum = (columnId: string) =>
    statusSelected(columnId)
      ? rows
          .filter(rowSelected)
          .reduce((sum, row) => sum + count(columnId, row), 0)
      : 0;
  const total = rows.reduce((sum, row) => sum + rowSum(row), 0);

  const cellStyle: React.CSSProperties = {
    border: '1px solid var(--bui-border-1)',
    padding: 8,
    textAlign: 'center',
    minWidth: 80,
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'left',
  };
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
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table
            aria-label="Priority matrix"
            style={{ borderCollapse: 'collapse', width: '100%' }}
          >
            <thead>
              <tr>
                <th style={headerCellStyle} aria-label="Priority" />
                {board.columns.map(column => (
                  <th key={column.id} style={cellStyle} scope="col">
                    <ToggleBadge
                      label={column.title}
                      color={column.color}
                      selected={statusSelected(column.id)}
                      onToggle={() =>
                        setUnselectedStatuses(current =>
                          toggled(current, column.id),
                        )
                      }
                    />
                  </th>
                ))}
                <th style={cellStyle} scope="col">
                  <Text variant="body-small" weight="bold">
                    Sum
                  </Text>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <th style={headerCellStyle} scope="row">
                    <ToggleBadge
                      label={row.name}
                      color={row.color}
                      selected={rowSelected(row)}
                      onToggle={() =>
                        setUnselectedRows(current => toggled(current, row.key))
                      }
                    />
                  </th>
                  {board.columns.map(column => (
                    <td key={column.id} style={cellStyle}>
                      <Text variant="body-small">{count(column.id, row)}</Text>
                    </td>
                  ))}
                  <td style={cellStyle}>
                    <Text variant="body-small" weight="bold">
                      {rowSum(row)}
                    </Text>
                  </td>
                </tr>
              ))}
              <tr>
                <th style={headerCellStyle} scope="row">
                  <Text variant="body-small" weight="bold">
                    Sum
                  </Text>
                </th>
                {board.columns.map(column => (
                  <td key={column.id} style={cellStyle}>
                    <Text variant="body-small" weight="bold">
                      {columnSum(column.id)}
                    </Text>
                  </td>
                ))}
                <td style={cellStyle}>
                  <Text variant="body-small" weight="bold">
                    {total}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DialogBody>
    </Dialog>
  );
}

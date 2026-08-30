import { useState } from 'react';
import { Text } from '@backstage/ui';
import {
  BoardColumn,
  BoardItem,
  ColumnColor,
} from '@internal/plugin-boards-common';
import { StatusChip } from '@internal/plugin-boards-react';

/** One row of a matrix: how it reads, and which items it counts. */
export interface MatrixRow {
  key: string;
  name: string;
  color?: ColumnColor;
  /** Hover text for the row's badge, e.g. an assignee's full ref. */
  title?: string;
  matches: (item: BoardItem) => boolean;
}

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
 * A header badge that toggles its status/row in and out of the sums.
 * Everything starts selected; an unselected badge dims but its cells
 * keep their counts.
 */
function ToggleBadge(props: {
  label: string;
  color?: ColumnColor;
  title?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      title={props.title}
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

/**
 * A matrix of item counts: the board's columns (statuses) across the
 * top, the caller's rows down the side, and a sum column, sum row and
 * overall total. Every header is a badge that toggles its status or row
 * out of the sums — an unselected one is excluded from all three sums,
 * including its own, while its cells keep their counts.
 *
 * The selection lives here, so a dialog that unmounts its body while
 * closed reopens fully selected.
 */
export function MatrixTable(props: {
  columns: BoardColumn[];
  /** The items to count, already narrowed by the active filters. */
  items: BoardItem[];
  rows: MatrixRow[];
  /** Names the table, e.g. "Priority matrix". */
  label: string;
  /** Names the row header column, e.g. "Priority". */
  rowHeaderLabel: string;
}) {
  const { columns, items, rows, label, rowHeaderLabel } = props;
  // stored as the *unselected* sets, so the default is everything selected
  const [unselectedStatuses, setUnselectedStatuses] = useState(
    new Set<string>(),
  );
  const [unselectedRows, setUnselectedRows] = useState(new Set<string>());

  const count = (columnId: string, row: MatrixRow) =>
    items.filter(item => item.columnId === columnId && row.matches(item))
      .length;
  const statusSelected = (columnId: string) =>
    !unselectedStatuses.has(columnId);
  const rowSelected = (row: MatrixRow) => !unselectedRows.has(row.key);
  // every sum counts only combinations whose status AND row are
  // selected, so an unselected axis reads 0 in its own sum too
  const rowSum = (row: MatrixRow) =>
    rowSelected(row)
      ? columns
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

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table
        aria-label={label}
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr>
            <th style={headerCellStyle} aria-label={rowHeaderLabel} />
            {columns.map(column => (
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
                  title={row.title}
                  selected={rowSelected(row)}
                  onToggle={() =>
                    setUnselectedRows(current => toggled(current, row.key))
                  }
                />
              </th>
              {columns.map(column => (
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
            {columns.map(column => (
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
  );
}

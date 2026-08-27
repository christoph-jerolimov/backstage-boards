import { BoardColumn, COLUMN_COLORS } from '@internal/plugin-boards-common';

const NEUTRAL = '#8a8f98';

export function columnColorHex(column?: BoardColumn): string {
  return column?.color ? COLUMN_COLORS[column.color] : NEUTRAL;
}

/** Small colored dot representing a column's color. */
export function ColumnDot(props: { column?: BoardColumn; size?: number }) {
  const size = props.size ?? 10;
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: columnColorHex(props.column),
        flexShrink: 0,
      }}
    />
  );
}

/** Status badge (dot + column title) used in the table and item drawer. */
export function StatusBadge(props: { column?: BoardColumn }) {
  const { column } = props;
  const hex = columnColorHex(column);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 10,
        background: `${hex}22`,
        border: `1px solid ${hex}55`,
        fontSize: '0.85em',
        whiteSpace: 'nowrap',
      }}
    >
      <ColumnDot column={column} size={8} />
      {column?.title ?? '?'}
    </span>
  );
}

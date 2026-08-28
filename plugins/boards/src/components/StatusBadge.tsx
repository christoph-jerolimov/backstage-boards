import {
  BoardColumn,
  COLUMN_COLORS,
  ColumnColor,
} from '@internal/plugin-boards-common';

/** What a column without a color of its own is drawn in. */
const NEUTRAL = '#8a8f98';

/** The hex a named color resolves to; neutral when there is none. */
export function colorHex(color?: ColumnColor): string {
  return color ? COLUMN_COLORS[color] : NEUTRAL;
}

export function columnColorHex(column?: BoardColumn): string {
  return colorHex(column?.color);
}

/**
 * The small filled circle standing for a column color, wherever one is
 * shown: beside a lane title, in the color picker, and inside a status
 * chip.
 */
export function ColorDot(props: { color?: ColumnColor; size?: number }) {
  const size = props.size ?? 10;
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorHex(props.color),
        flexShrink: 0,
      }}
    />
  );
}

/** The dot for a column, which may or may not carry a color. */
export function ColumnDot(props: { column?: BoardColumn; size?: number }) {
  return <ColorDot color={props.column?.color} size={props.size} />;
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

import type { ReactNode } from 'react';
import {
  BoardColumn,
  BoardPriority,
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

/** The sizes the status chip comes in. */
type StatusChipSize = 'small' | 'medium';

const CHIP_SIZES = {
  small: { gap: 4, padding: '1px 6px', fontSize: '0.75em', dot: 6 },
  medium: { gap: 6, padding: '2px 8px', fontSize: '0.85em', dot: 8 },
} as const;

/**
 * A pill naming a status: a dot in the column's color, a background and
 * border tinted to match, and whatever the caller labels it with — the
 * column title on a board, the title and a count on the home page card.
 */
export function StatusChip(props: {
  color?: ColumnColor;
  size?: StatusChipSize;
  children: ReactNode;
}) {
  const size = CHIP_SIZES[props.size ?? 'medium'];
  const hex = colorHex(props.color);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size.gap,
        padding: size.padding,
        borderRadius: 10,
        background: `${hex}22`,
        border: `1px solid ${hex}55`,
        fontSize: size.fontSize,
        whiteSpace: 'nowrap',
      }}
    >
      <ColorDot color={props.color} size={size.dot} />
      {props.children}
    </span>
  );
}

/** Status badge (dot + column title) used in the table and item drawer. */
export function StatusBadge(props: { column?: BoardColumn }) {
  return (
    <StatusChip color={props.column?.color}>
      {props.column?.title ?? '?'}
    </StatusChip>
  );
}

/**
 * A pill naming an item's priority in the priority's color (neutral when
 * it has none); renders nothing without a priority.
 */
export function PriorityChip(props: {
  priority?: BoardPriority;
  size?: StatusChipSize;
}) {
  if (!props.priority) {
    return null;
  }
  return (
    <StatusChip color={props.priority.color} size={props.size}>
      {props.priority.name}
    </StatusChip>
  );
}

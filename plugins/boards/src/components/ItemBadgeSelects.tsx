import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Text } from '@backstage/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import {
  BoardColumn,
  BoardPriority,
  ColumnColor,
  fridayISO,
  todayISO,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import { ColorDot, colorHex, PriorityChip, StatusBadge } from './StatusBadge';
import { DueDateBadge } from './DueDate';

/**
 * The status-chip look on a real menu-trigger button: the badge is the
 * control, so it must read as one — a chevron marks it as a select, and
 * the button is keyboard-focusable like any other. Right-click opens the
 * same menu instead of the browser's, which is why the trigger is
 * controlled.
 */
function BadgeSelect(props: {
  ariaLabel: string;
  color?: ColumnColor;
  /** Renders the color dot in front (status and priority chips). */
  dot?: boolean;
  label: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hex = colorHex(props.color);
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    setOpen(true);
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- forwards right-click to the button's menu; the button itself handles keyboard and click
    <span onContextMenu={onContextMenu} style={{ display: 'inline-flex' }}>
      <MenuTrigger isOpen={open} onOpenChange={setOpen}>
        <Button
          aria-label={props.ariaLabel}
          variant="tertiary"
          size="small"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 'auto',
            minWidth: 0,
            padding: '2px 8px',
            borderRadius: 10,
            background: `${hex}22`,
            border: `1px solid ${hex}55`,
            fontSize: '0.85em',
            whiteSpace: 'nowrap',
          }}
        >
          {props.dot && <ColorDot color={props.color} size={8} />}
          {props.label}
          <RiArrowDownSLine aria-hidden size={14} />
        </Button>
        {props.children}
      </MenuTrigger>
    </span>
  );
}

/**
 * The item's status as a badge that is also the way to change it: the
 * board's columns open under it, the current one marked. Read-only
 * surfaces get the plain badge.
 */
export function StatusBadgeSelect(props: {
  columns: BoardColumn[];
  columnId: string;
  readonly: boolean;
  /** Columns at their hard WIP limit: their entries disable. */
  fullColumnIds?: Set<string>;
  onSelect: (columnId: string) => void;
}) {
  const current = props.columns.find(column => column.id === props.columnId);
  if (props.readonly) {
    return <StatusBadge column={current} />;
  }
  const title = current?.title ?? '?';
  return (
    <BadgeSelect
      ariaLabel={`Change status: ${title}`}
      color={current?.color}
      dot
      label={title}
    >
      <Menu>
        {props.columns.map(column => (
          <MenuItem
            key={column.id}
            isDisabled={
              column.id !== props.columnId &&
              props.fullColumnIds?.has(column.id)
            }
            onAction={() => {
              if (column.id !== props.columnId) {
                props.onSelect(column.id);
              }
            }}
          >
            {column.id === props.columnId ? `✓ ${column.title}` : column.title}
          </MenuItem>
        ))}
      </Menu>
    </BadgeSelect>
  );
}

/**
 * The item's priority as a badge that is also the way to change it: the
 * board's priorities open under it plus a clear entry, the current one
 * marked. Read-only surfaces get the plain chip (nothing when unset);
 * callers hide it entirely on boards without priorities.
 */
export function PrioritySelect(props: {
  priorities: BoardPriority[];
  priorityId?: string;
  readonly: boolean;
  onSelect: (priorityId: string | null) => void;
}) {
  const current = props.priorities.find(
    priority => priority.id === props.priorityId,
  );
  if (props.readonly) {
    return <PriorityChip priority={current} />;
  }
  const name = current?.name ?? 'No priority';
  return (
    <BadgeSelect
      ariaLabel={`Change priority: ${name}`}
      color={current?.color}
      dot
      label={name}
    >
      <Menu>
        {[...props.priorities]
          .sort((a, b) => a.order - b.order)
          .map(priority => (
            <MenuItem
              key={priority.id}
              onAction={() => {
                if (priority.id !== props.priorityId) {
                  props.onSelect(priority.id);
                }
              }}
            >
              {priority.id === props.priorityId
                ? `✓ ${priority.name}`
                : priority.name}
            </MenuItem>
          ))}
        <MenuItem
          onAction={() => {
            if (props.priorityId) {
              props.onSelect(null);
            }
          }}
        >
          {current ? 'No priority' : '✓ No priority'}
        </MenuItem>
      </Menu>
    </BadgeSelect>
  );
}

/**
 * The item's due date as a badge that is also the way to change it: the
 * quick options open under it, and "Pick a date…" swaps the chip for a
 * focused date input so any calendar date stays reachable. Read-only
 * surfaces get the plain due-date display.
 */
export function DueDateSelect(props: {
  dueDate?: string;
  readonly: boolean;
  onChange: (dueDate: string | null) => void;
}) {
  const { dueDate, readonly, onChange } = props;
  const [picking, setPicking] = useState(false);

  const display = dueDate ? (
    <DueDateBadge dueDate={dueDate} />
  ) : (
    <Text variant="body-x-small" color="secondary">
      No due date
    </Text>
  );

  if (readonly) {
    return display;
  }

  if (picking) {
    return (
      <input
        type="date"
        aria-label="Due date"
        defaultValue={dueDate ?? todayISO()}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just asked for the picker; focus belongs on it
        autoFocus
        onChange={event => {
          if (event.target.value) {
            onChange(event.target.value);
            setPicking(false);
          }
        }}
        onBlur={() => setPicking(false)}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setPicking(false);
          }
        }}
        style={{
          background: 'var(--bui-bg-neutral-1)',
          color: 'inherit',
          border: '1px solid var(--bui-border-1)',
          borderRadius: 4,
          padding: '2px 8px',
          font: 'inherit',
          fontSize: '0.85em',
        }}
      />
    );
  }

  return (
    <BadgeSelect ariaLabel="Change due date" label={display}>
      <Menu>
        <MenuItem onAction={() => onChange(todayISO())}>Today</MenuItem>
        <MenuItem onAction={() => onChange(tomorrowISO())}>Tomorrow</MenuItem>
        <MenuItem onAction={() => onChange(fridayISO())}>
          This week (Fri)
        </MenuItem>
        <MenuItem onAction={() => setPicking(true)}>Pick a date…</MenuItem>
        {dueDate && (
          <MenuItem color="danger" onAction={() => onChange(null)}>
            Remove due date
          </MenuItem>
        )}
      </Menu>
    </BadgeSelect>
  );
}

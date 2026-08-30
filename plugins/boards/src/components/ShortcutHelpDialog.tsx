import { Fragment } from 'react';
import { Dialog, DialogBody, DialogHeader, Text } from '@backstage/ui';

/** One line of the cheat sheet: its key badges and what they do. */
export interface ShortcutRow {
  keys: string[];
  /**
   * How multiple keys read between their badges: 'or' for strict
   * alternatives ("s, c or m"), 'slash' for directional pairs
   * ("← / →"). Every key of a row triggers the same action on its own —
   * never a chord.
   */
  conjunction?: 'or' | 'slash';
  description: string;
  /** Hidden for read-only visitors. */
  needsWrite?: boolean;
  /** Hidden on boards without priorities. */
  needsPriorities?: boolean;
  /** The `event.key` values of `handleItemShortcut` this row documents
   * (with `ctrl:` for the Ctrl combinations) — the drift-guard test
   * checks every handled key is covered by some row. */
  covers?: string[];
}

/** The navigation shortcuts — available to everyone. */
export const NAVIGATION_SHORTCUT_ROWS: ShortcutRow[] = [
  {
    keys: ['↑', '↓'],
    description: 'Previous / next item — table rows continue across the groups',
  },
  {
    keys: ['←', '→'],
    description: 'Neighbouring column on the board (no effect in the table)',
  },
  {
    keys: ['?'],
    description: 'Show this overview',
  },
];

/** The shortcuts acting on the focused card or row. */
export const ITEM_SHORTCUT_ROWS: ShortcutRow[] = [
  {
    keys: ['Ctrl+←', 'Ctrl+→'],
    description: 'Move the item one column left / right',
    needsWrite: true,
    covers: ['ctrl:ArrowLeft', 'ctrl:ArrowRight'],
  },
  {
    keys: ['Space'],
    description: 'Select / deselect the item for bulk actions',
    needsWrite: true,
    covers: [' '],
  },
  {
    keys: ['Enter'],
    description: "Open the item's actions menu",
    covers: ['Enter'],
  },
  {
    keys: ['s', 'c', 'm'],
    conjunction: 'or',
    description: 'Move to another column (status picker)',
    needsWrite: true,
    covers: ['s', 'c', 'm'],
  },
  {
    keys: ['a'],
    description: 'Change the assignees',
    needsWrite: true,
    covers: ['a'],
  },
  {
    keys: ['d'],
    description: 'Set the due date',
    needsWrite: true,
    covers: ['d'],
  },
  {
    keys: ['p'],
    description: 'Set the priority',
    needsWrite: true,
    needsPriorities: true,
    covers: ['p'],
  },
  {
    keys: ['1–9', '0'],
    conjunction: 'or',
    description: 'Set the priority with that order (0 = 10)',
    needsWrite: true,
    needsPriorities: true,
    covers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  },
  {
    keys: ['Delete'],
    description: 'Archive the item',
    needsWrite: true,
    covers: ['Delete'],
  },
];

/** The rows a given viewer actually gets on a given board. */
export function visibleShortcutRows(
  rows: ShortcutRow[],
  options: { canWrite: boolean; hasPriorities: boolean },
): ShortcutRow[] {
  return rows.filter(
    row =>
      (!row.needsWrite || options.canWrite) &&
      (!row.needsPriorities || options.hasPriorities),
  );
}

function KeyBadge(props: { label: string }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        minWidth: 20,
        padding: '1px 6px',
        textAlign: 'center',
        border: '1px solid var(--bui-border-1)',
        borderRadius: 4,
        background: 'var(--bui-bg-neutral-2)',
        fontFamily: 'inherit',
        fontSize: '0.85em',
      }}
    >
      {props.label}
    </kbd>
  );
}

function RowList(props: { title: string; rows: ShortcutRow[] }) {
  if (props.rows.length === 0) {
    return null;
  }
  return (
    <>
      <Text variant="body-medium" weight="bold" as="h3">
        {props.title}
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 16,
          rowGap: 6,
          alignItems: 'baseline',
        }}
      >
        {props.rows.map(row => (
          <Fragment key={row.keys.join('-')}>
            <span style={{ whiteSpace: 'nowrap' }}>
              {row.keys.map((key, index) => (
                <Fragment key={key}>
                  {/* spell the relation out so several badges never
                      read as a chord: "s, c or m", "← / →" */}
                  {index > 0 &&
                    (row.conjunction === 'or'
                      ? `${index === row.keys.length - 1 ? ' or ' : ', '}`
                      : ' / ')}
                  <KeyBadge label={key} />
                </Fragment>
              ))}
            </span>
            <Text variant="body-small">{row.description}</Text>
          </Fragment>
        ))}
      </div>
    </>
  );
}

/**
 * The cheat sheet the board page opens on `?`: every keyboard shortcut
 * of the board and table views, with the rows the viewer cannot use
 * (write actions for readers, priority keys on boards without
 * priorities) left out.
 */
export function ShortcutHelpDialog(props: {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
  hasPriorities: boolean;
}) {
  const { open, onClose, canWrite, hasPriorities } = props;
  const options = { canWrite, hasPriorities };
  return (
    <Dialog
      isOpen={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogHeader>Keyboard shortcuts</DialogHeader>
      <DialogBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RowList
            title="Navigate"
            rows={visibleShortcutRows(NAVIGATION_SHORTCUT_ROWS, options)}
          />
          <RowList
            title="Focused item"
            rows={visibleShortcutRows(ITEM_SHORTCUT_ROWS, options)}
          />
        </div>
      </DialogBody>
    </Dialog>
  );
}

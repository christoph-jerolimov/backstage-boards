import { useEffect, useMemo, useRef, useState } from 'react';
import { storageApiRef, useApi } from '@backstage/frontend-plugin-api';
import { ButtonIcon, Menu, MenuItem, MenuTrigger } from '@backstage/ui';
import { RiLayoutColumnLine } from '@remixicon/react';

/**
 * The data columns an item table can show, in display order. The title
 * column is the row header and is always visible; the trailing actions
 * column and my-items' grouping-governed board column are controls
 * outside this model.
 */
export const TABLE_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due' },
  { id: 'assignees', label: 'Assignees' },
  { id: 'tags', label: 'Tags' },
  { id: 'createdBy', label: 'Created by' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedBy', label: 'Updated by' },
  { id: 'updatedAt', label: 'Updated' },
] as const;

export type TableColumnId = (typeof TABLE_COLUMNS)[number]['id'];

/** What a table shows before the user configures anything. */
export const DEFAULT_VISIBLE_COLUMNS: TableColumnId[] = [
  'title',
  'status',
  'priority',
  'dueDate',
  'assignees',
  'tags',
];

const BUCKET = 'boards-table-columns';

function isColumnId(value: unknown): value is TableColumnId {
  return TABLE_COLUMNS.some(column => column.id === value);
}

/** Stored payloads may be old or foreign: keep what's known, force title. */
function sanitize(value: unknown): Set<TableColumnId> {
  const stored = Array.isArray(value) ? value.filter(isColumnId) : undefined;
  return new Set<TableColumnId>([
    'title',
    ...(stored ?? DEFAULT_VISIBLE_COLUMNS),
  ]);
}

/**
 * The visible columns of one item table, stored per user through the
 * storage (user settings) API — keyed by the board id, or `my-items`
 * for the cross-board listing — so the choice survives reloads and
 * stays independent per board and per user.
 */
export function useVisibleColumns(
  key: string,
): [Set<TableColumnId>, (id: TableColumnId) => void] {
  const storageApi = useApi(storageApiRef);
  const bucket = useMemo(() => storageApi.forBucket(BUCKET), [storageApi]);
  const [visible, setVisible] = useState<Set<TableColumnId>>(() =>
    sanitize(bucket.snapshot(key).value),
  );
  const touched = useRef(false);

  // an async storage backend (the user-settings service) delivers the
  // stored choice after mount; adopt it only while nothing was toggled
  useEffect(() => {
    const subscription = bucket.observe$(key).subscribe(snapshot => {
      if (!touched.current && snapshot.presence === 'present') {
        setVisible(sanitize(snapshot.value));
      }
    });
    return () => subscription.unsubscribe();
  }, [bucket, key]);

  const toggle = (id: TableColumnId) => {
    if (id === 'title') {
      return;
    }
    touched.current = true;
    const next = new Set(visible);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setVisible(next);
    bucket.set(
      key,
      TABLE_COLUMNS.map(column => column.id).filter(columnId =>
        next.has(columnId),
      ),
    );
  };

  return [visible, toggle];
}

/**
 * The small dropdown that shows/hides an item table's columns. The
 * title column is not offered (always shown); the priority entry only
 * appears while the view offers the priority feature at all.
 */
export function ColumnsMenu(props: {
  visible: Set<TableColumnId>;
  onToggle: (id: TableColumnId) => void;
  /** Offer the priority entry; off on views without used priorities. */
  showPriority: boolean;
}) {
  return (
    <MenuTrigger>
      <ButtonIcon
        aria-label="Configure columns"
        variant="tertiary"
        size="small"
        icon={<RiLayoutColumnLine size={16} />}
      />
      <Menu>
        {TABLE_COLUMNS.filter(column => column.id !== 'title')
          .filter(column => column.id !== 'priority' || props.showPriority)
          .map(column => (
            <MenuItem
              key={column.id}
              onAction={() => props.onToggle(column.id)}
            >
              {props.visible.has(column.id)
                ? `✓ ${column.label}`
                : column.label}
            </MenuItem>
          ))}
      </Menu>
    </MenuTrigger>
  );
}

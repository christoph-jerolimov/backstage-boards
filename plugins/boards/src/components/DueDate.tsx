import { Text } from '@backstage/ui';
import { DueState, dueState } from '@internal/plugin-boards-common';

const DUE_COLORS: Record<DueState, string | undefined> = {
  overdue: 'var(--bui-fg-negative)',
  today: 'var(--bui-fg-warning)',
  upcoming: undefined,
};

/** `2026-08-29` → `Aug 29` (with year when it differs from the current). */
export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const sameYear = year === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

/**
 * Compact due-date label: warning color when due today, error color when
 * overdue, secondary otherwise.
 */
export function DueDateBadge(props: { dueDate?: string }) {
  const { dueDate } = props;
  if (!dueDate) {
    return null;
  }
  const state = dueState(dueDate);
  const color = DUE_COLORS[state];
  const prefix = state === 'overdue' ? 'Overdue' : 'Due';
  return (
    <Text
      variant="body-x-small"
      color={color ? undefined : 'secondary'}
      style={color ? { color, fontWeight: 600 } : undefined}
      data-due-state={state}
    >
      {prefix} {formatDueDate(dueDate)}
    </Text>
  );
}

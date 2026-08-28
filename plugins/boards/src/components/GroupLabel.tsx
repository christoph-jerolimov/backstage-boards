import { BoardPriority, relativeDueLabel } from '@internal/plugin-boards-common';
import { RefDisplay } from './common';
import { formatDueDate } from './DueDate';
import { GroupByMode, REST_KEY, REST_LABEL } from './grouping';
import { ColorDot } from './StatusBadge';

/** Human label for a group heading produced by `groupItems`. */
export function GroupLabel(props: {
  mode: GroupByMode;
  groupKey: string;
  /** The board's priorities; resolves a priority group's id. */
  priorities?: BoardPriority[];
  /** The group's item count, shown for priority groups. */
  count?: number;
}) {
  const { mode, groupKey, priorities, count } = props;
  if (mode === 'none') {
    return null;
  }
  const countSuffix = count === undefined ? '' : ` (${count})`;
  if (groupKey === REST_KEY[mode]) {
    return (
      <>
        {REST_LABEL[mode]}
        {mode === 'priority' ? countSuffix : ''}
      </>
    );
  }
  if (mode === 'assignee') {
    return <RefDisplay refString={groupKey} />;
  }
  if (mode === 'priority') {
    const priority = priorities?.find(entry => entry.id === groupKey);
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <ColorDot color={priority?.color} size={8} />
        {priority?.name ?? '?'}
        {countSuffix}
      </span>
    );
  }
  if (mode === 'dueDate') {
    const relative = relativeDueLabel(groupKey);
    return <>{relative ? `Due ${relative}` : formatDueDate(groupKey)}</>;
  }
  return <>{groupKey}</>;
}

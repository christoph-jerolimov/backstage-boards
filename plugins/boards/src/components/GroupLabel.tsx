import { relativeDueLabel } from '@internal/plugin-boards-common';
import { RefDisplay } from './common';
import { formatDueDate } from './DueDate';
import { GroupByMode, REST_KEY, REST_LABEL } from './grouping';

/** Human label for a group heading produced by `groupItems`. */
export function GroupLabel(props: { mode: GroupByMode; groupKey: string }) {
  const { mode, groupKey } = props;
  if (mode === 'none') {
    return null;
  }
  if (groupKey === REST_KEY[mode]) {
    return <>{REST_LABEL[mode]}</>;
  }
  if (mode === 'assignee') {
    return <RefDisplay refString={groupKey} />;
  }
  if (mode === 'dueDate') {
    const relative = relativeDueLabel(groupKey);
    return <>{relative ? `Due ${relative}` : formatDueDate(groupKey)}</>;
  }
  return <>{groupKey}</>;
}

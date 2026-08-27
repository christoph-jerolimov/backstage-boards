import { relativeDueLabel } from '@internal/plugin-boards-common';
import { RefDisplay } from './common';
import { formatDueDate } from './DueDate';
import { GroupByMode, NO_DUE_DATE, UNASSIGNED, UNTAGGED } from './grouping';

/** Human label for a group heading produced by `groupItems`. */
export function GroupLabel(props: { mode: GroupByMode; groupKey: string }) {
  const { mode, groupKey } = props;
  if (mode === 'assignee') {
    return groupKey === UNASSIGNED ? (
      <>Unassigned</>
    ) : (
      <RefDisplay refString={groupKey} />
    );
  }
  if (mode === 'dueDate') {
    if (groupKey === NO_DUE_DATE) {
      return <>No due date</>;
    }
    const relative = relativeDueLabel(groupKey);
    return <>{relative ? `Due ${relative}` : formatDueDate(groupKey)}</>;
  }
  if (mode === 'tags') {
    return groupKey === UNTAGGED ? <>Untagged</> : <>{groupKey}</>;
  }
  return null;
}

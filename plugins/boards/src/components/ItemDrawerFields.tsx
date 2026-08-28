import type { ReactNode } from 'react';
import { Button, Flex, Text } from '@backstage/ui';
import { BoardItem } from '@internal/plugin-boards-common';
import { DueDateBadge } from './DueDate';
import { PrincipalPicker } from './PrincipalPicker';
import { formatDate, RefChips, RefDisplay } from './common';

/** A labelled block of the drawer body. */
export function DrawerField(props: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text variant="body-small" color="secondary">
        {props.label}
      </Text>
      {props.children}
    </div>
  );
}

/** The item's due date, with a picker and a clear button while writable. */
export function DueDateField(props: {
  dueDate?: string;
  readonly: boolean;
  onChange: (dueDate: string | null) => Promise<void>;
}) {
  const { dueDate, readonly, onChange } = props;
  return (
    <DrawerField label="Due date">
      <Flex align="center" gap="2">
        {dueDate ? (
          <DueDateBadge dueDate={dueDate} />
        ) : (
          <Text variant="body-small" color="secondary">
            No due date
          </Text>
        )}
        {!readonly && (
          <input
            type="date"
            aria-label="Due date"
            value={dueDate ?? ''}
            onChange={event =>
              onChange(event.target.value === '' ? null : event.target.value)
            }
            style={{
              background: 'var(--bui-bg-neutral-1)',
              color: 'inherit',
              border: '1px solid var(--bui-border-1)',
              borderRadius: 4,
              padding: '4px 8px',
              font: 'inherit',
            }}
          />
        )}
        {!readonly && dueDate && (
          <Button
            variant="tertiary"
            size="small"
            onPress={() => onChange(null)}
          >
            Clear
          </Button>
        )}
      </Flex>
    </DrawerField>
  );
}

/** The item's assignees as removable chips, with a picker to add more. */
export function AssigneesField(props: {
  assignees: string[];
  readonly: boolean;
  onChange: (assignees: string[]) => Promise<void>;
}) {
  const { assignees, readonly, onChange } = props;
  return (
    <DrawerField label="Assignees">
      <Flex direction="column" gap="2">
        {assignees.length > 0 ? (
          <RefChips
            refs={assignees}
            withAvatars
            onRemove={
              readonly
                ? undefined
                : removed => onChange(assignees.filter(ref => ref !== removed))
            }
          />
        ) : (
          <Text variant="body-small" color="secondary">
            Unassigned
          </Text>
        )}
        {!readonly && (
          <PrincipalPicker
            ariaLabel="Add assignee"
            placeholder="Add assignee…"
            allowText
            exclude={assignees}
            onSelect={ref => onChange([...assignees, ref])}
          />
        )}
      </Flex>
    </DrawerField>
  );
}

/** Who created and last changed the item, and when. */
export function ItemMetadata(props: { item: BoardItem }) {
  const { item } = props;
  return (
    <Flex direction="column" gap="1">
      <Text variant="body-x-small" color="secondary">
        Created by <RefDisplay refString={item.createdBy} /> at{' '}
        {formatDate(item.createdAt)}
      </Text>
      {item.creatorRef && (
        <Text variant="body-x-small" color="secondary">
          Creator: <RefDisplay refString={item.creatorRef} />
        </Text>
      )}
      <Text variant="body-x-small" color="secondary">
        Updated by <RefDisplay refString={item.updatedBy} /> at{' '}
        {formatDate(item.updatedAt)}
      </Text>
    </Flex>
  );
}

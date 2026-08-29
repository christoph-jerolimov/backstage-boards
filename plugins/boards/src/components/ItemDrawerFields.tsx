import type { ReactNode } from 'react';
import { Flex, Text } from '@backstage/ui';
import { BoardItem } from '@internal/plugin-boards-common';
import { PrincipalPicker } from './PrincipalPicker';
import { formatDate, RefChips, RefDisplay } from './common';

/** A headlined section of the drawer body, grouping related blocks. */
export function DrawerSection(props: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      <Text variant="body-medium" weight="bold" as="h3">
        {props.title}
      </Text>
      {props.children}
    </Flex>
  );
}

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

/**
 * The item's assignees as borderless avatar chips, with the picker to
 * add more sitting inline behind them.
 */
export function AssigneesField(props: {
  assignees: string[];
  readonly: boolean;
  onChange: (assignees: string[]) => Promise<void>;
}) {
  const { assignees, readonly, onChange } = props;
  return (
    <DrawerField label="Assignees">
      <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
        {assignees.length > 0 ? (
          <RefChips
            refs={assignees}
            withAvatars
            plain
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

import type { ReactNode } from 'react';
import { Flex, Text } from '@backstage/ui';
import { PrincipalPicker } from './PrincipalPicker';
import { RefChips } from './common';

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

/**
 * The item's assignees as borderless avatar chips, with the picker to
 * add more sitting inline behind them. The caller provides the label
 * (the drawer's field table does).
 */
export function AssigneesField(props: {
  assignees: string[];
  readonly: boolean;
  onChange: (assignees: string[]) => Promise<void>;
}) {
  const { assignees, readonly, onChange } = props;
  return (
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
  );
}

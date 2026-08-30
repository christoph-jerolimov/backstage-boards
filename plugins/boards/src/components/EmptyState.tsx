import type { ReactNode } from 'react';
import { Flex, Text } from '@backstage/ui';

/**
 * Backstage-style empty/error state block: a muted icon circle, a
 * title, an optional description, and optional actions, centered with
 * generous padding. Shared by the board page's not-found and error
 * states, the reader's column-less board, and the board list's empty
 * tabs.
 */
export function EmptyState(props: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const { icon, title, description, actions } = props;
  return (
    <Flex
      direction="column"
      align="center"
      gap="3"
      style={{ padding: '48px 16px', textAlign: 'center' }}
    >
      {icon && (
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bui-bg-neutral-2)',
            color: 'var(--bui-fg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      )}
      <Text variant="title-small" weight="bold" as="h2">
        {title}
      </Text>
      {description && (
        <Text color="secondary" style={{ maxWidth: 440 }}>
          {description}
        </Text>
      )}
      {actions && (
        <Flex gap="2" justify="center">
          {actions}
        </Flex>
      )}
    </Flex>
  );
}

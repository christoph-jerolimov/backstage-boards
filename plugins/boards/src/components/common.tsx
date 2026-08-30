import { Badge, Button, Flex } from '@backstage/ui';
import { RefDisplay } from '@internal/plugin-boards-react';
import { AssigneeAvatars } from './AssigneeAvatars';

/** One ref as a chip: a catalog ref links, a `text:` ref reads plainly. */
function RefChip(props: {
  refString: string;
  withAvatar?: boolean;
  plain?: boolean;
  onRemove?: (ref: string) => void;
}) {
  const { refString, withAvatar, plain, onRemove } = props;
  // AssigneeAvatars already tells catalog refs and text refs apart
  const content = withAvatar ? (
    <AssigneeAvatars
      refs={[refString]}
      align={plain ? 'baseline' : undefined}
    />
  ) : (
    <RefDisplay refString={refString} />
  );
  if (!withAvatar && !onRemove) {
    return <Badge size="small">{content}</Badge>;
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: plain ? 'baseline' : 'center',
        gap: 4,
        ...(plain
          ? {}
          : {
              border: '1px solid var(--bui-border-1)',
              borderRadius: 12,
              padding: onRemove ? '2px 4px 2px 8px' : '2px 8px',
            }),
      }}
    >
      {content}
      {onRemove && (
        <Button
          variant="tertiary"
          size="small"
          aria-label={`Remove assignee ${refString}`}
          onPress={() => onRemove(refString)}
        >
          ✕
        </Button>
      )}
    </span>
  );
}

/**
 * A row of refs as chips. With `withAvatars` the catalog refs show their
 * profile picture, `onRemove` puts a remove button in each chip, and
 * `plain` drops the chip border for surfaces that don't want it.
 */
export function RefChips(props: {
  refs: string[];
  withAvatars?: boolean;
  plain?: boolean;
  onRemove?: (ref: string) => void;
}) {
  if (props.refs.length === 0) {
    return null;
  }
  return (
    <Flex
      gap="1"
      align={props.plain ? 'baseline' : 'center'}
      style={{ flexWrap: 'wrap' }}
    >
      {props.refs.map(ref => (
        <RefChip
          key={ref}
          refString={ref}
          withAvatar={props.withAvatars}
          plain={props.plain}
          onRemove={props.onRemove}
        />
      ))}
    </Flex>
  );
}

/** Human wording for a change record, shared by timeline and change feed. */
export function changeSummary(change: {
  type: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}): string {
  if (change.type === 'created') {
    return 'created this item';
  }
  if (change.type === 'archived') {
    return 'archived this item';
  }
  if (change.type === 'restored') {
    return 'restored this item';
  }
  if (change.type === 'moved') {
    return `moved this item from “${String(change.oldValue)}” to “${String(
      change.newValue,
    )}”`;
  }
  if (change.oldValue === undefined && change.newValue === undefined) {
    return `changed the ${change.field}`;
  }
  return `changed ${change.field}: ${
    JSON.stringify(change.oldValue) ?? '(empty)'
  } → ${JSON.stringify(change.newValue) ?? '(empty)'}`;
}

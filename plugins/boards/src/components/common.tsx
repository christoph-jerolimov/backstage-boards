import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Flex, Text, TextField } from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import {
  errorMessage,
  isTextRef,
  textRefDisplay,
} from '@internal/plugin-boards-common';
import { AssigneeAvatars } from './AssigneeAvatars';
import { BlockToken, InlineToken, parseMarkdown } from './markdown';

/**
 * Narrows a selection key coming back from a `Select`, `Tabs` or
 * `ToggleButtonGroup` to one of the options that was offered. Those
 * callbacks are typed as a bare react-aria `Key`, so matching the key
 * against the option list is what turns it back into the union the rest
 * of the code works with; an unknown key yields undefined.
 */
export function selectedOption<T extends string>(
  key: unknown,
  options: readonly T[],
): T | undefined {
  return options.find(option => option === key);
}

/**
 * A ref's resolved display name with the ref itself as a native tooltip,
 * so the identity behind the name stays reachable. `text:` refs carry no
 * tooltip: their label already is their whole value. The `title` sits on
 * a span rather than a design-system `Tooltip` because these labels live
 * inside menu items, whose focus is react-aria's to manage.
 */
export function RefLabel(props: {
  entityRef: string;
  children: React.ReactNode;
}) {
  const { entityRef, children } = props;
  if (isTextRef(entityRef)) {
    return <>{children}</>;
  }
  return <span title={entityRef}>{children}</span>;
}

/** Renders a creator/assignee/actor ref: catalog refs link, `text:` refs don't. */
export function RefDisplay(props: { refString: string }) {
  const { refString } = props;
  if (isTextRef(refString)) {
    return <span>{textRefDisplay(refString)}</span>;
  }
  return <EntityRefLink entityRef={refString} />;
}

/** A comma-separated run of entity links, as a board's references read. */
export function EntityRefList(props: { entityRefs: string[] }) {
  return (
    <>
      {props.entityRefs.map((ref, index) => (
        <span key={ref}>
          {index > 0 && ', '}
          <EntityRefLink entityRef={ref} />
        </span>
      ))}
    </>
  );
}

/** One ref as a chip: a catalog ref links, a `text:` ref reads plainly. */
function RefChip(props: {
  refString: string;
  withAvatar?: boolean;
  onRemove?: (ref: string) => void;
}) {
  const { refString, withAvatar, onRemove } = props;
  // AssigneeAvatars already tells catalog refs and text refs apart
  const content = withAvatar ? (
    <AssigneeAvatars refs={[refString]} />
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
        alignItems: 'center',
        gap: 4,
        border: '1px solid var(--bui-border-1)',
        borderRadius: 12,
        padding: onRemove ? '2px 4px 2px 8px' : '2px 8px',
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
 * profile picture, and `onRemove` puts a remove button in each chip.
 */
export function RefChips(props: {
  refs: string[];
  withAvatars?: boolean;
  onRemove?: (ref: string) => void;
}) {
  if (props.refs.length === 0) {
    return null;
  }
  return (
    <Flex gap="1" align="center" style={{ flexWrap: 'wrap' }}>
      {props.refs.map(ref => (
        <RefChip
          key={ref}
          refString={ref}
          withAvatar={props.withAvatars}
          onRemove={props.onRemove}
        />
      ))}
    </Flex>
  );
}

function InlineTokens(props: { tokens: InlineToken[] }) {
  return (
    <>
      {props.tokens.map((token, index) => {
        switch (token.type) {
          case 'text':
            return <span key={index}>{token.value}</span>;
          case 'bold':
            return (
              <strong key={index}>
                <InlineTokens tokens={token.children} />
              </strong>
            );
          case 'italic':
            return (
              <em key={index}>
                <InlineTokens tokens={token.children} />
              </em>
            );
          case 'code':
            return <code key={index}>{token.value}</code>;
          case 'link':
            return (
              <a
                key={index}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InlineTokens tokens={token.children} />
              </a>
            );
          case 'entity':
            return <EntityRefLink key={index} entityRef={token.entityRef} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** Safe renderer for the comment markdown subset with entity auto-linking. */
export function MarkdownContent(props: { text: string }) {
  const blocks: BlockToken[] = parseMarkdown(props.text);
  return (
    <div>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <Text key={index} as="p">
                <InlineTokens tokens={block.children} />
              </Text>
            );
          case 'codeBlock':
            return (
              <pre key={index} style={{ overflowX: 'auto' }}>
                <code>{block.value}</code>
              </pre>
            );
          case 'list': {
            const items = block.items.map((tokens, itemIndex) => (
              <li key={itemIndex}>
                <InlineTokens tokens={tokens} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index}>{items}</ol>
            ) : (
              <ul key={index}>{items}</ul>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

/**
 * An error message. One style for every failure the plugin reports, from
 * the design system's status colors rather than a hand-picked hex.
 */
export function ErrorText(props: { children: React.ReactNode }) {
  return (
    <Text variant="body-small" color="danger">
      {props.children}
    </Text>
  );
}

/**
 * The loading → error → empty → content sequence every list in the plugin
 * renders. The states are given as nodes rather than rendered here, so a
 * menu can put them in menu items and a page in plain text.
 *
 * `items` is what emptiness is measured on: usually the query's rows, but
 * a caller that groups or filters them first passes the derived list.
 */
export function AsyncList<T>(props: {
  isLoading: boolean;
  error?: unknown;
  /** The rows to render, or undefined while they are not loaded yet. */
  items?: T[];
  loading?: React.ReactNode;
  empty: React.ReactNode;
  renderError?: (message: string) => React.ReactNode;
  children: (items: T[]) => React.ReactNode;
}): React.ReactNode {
  const { isLoading, error, items, loading, empty, renderError } = props;
  if (error) {
    const message = errorMessage(error);
    return renderError ? (
      renderError(message)
    ) : (
      <ErrorText>{message}</ErrorText>
    );
  }
  if (isLoading || items === undefined) {
    return loading ?? <Text>Loading…</Text>;
  }
  if (items.length === 0) {
    return empty;
  }
  return props.children(items);
}

/**
 * Click-to-edit text. Renders as text until clicked (when `canEdit`),
 * then as a text field; Enter or blur commits, Escape cancels.
 */
export function InlineEdit(props: {
  value: string;
  canEdit: boolean;
  onCommit: (value: string) => Promise<void> | void;
  display?: React.ReactNode;
  ariaLabel: string;
  placeholder?: string;
}) {
  const { value, canEdit, onCommit, display, ariaLabel, placeholder } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = useCallback(async () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) {
      await onCommit(next);
    } else {
      setDraft(value);
    }
  }, [draft, value, onCommit]);

  if (!editing) {
    return (
      <span
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? `Edit ${ariaLabel}` : undefined}
        style={canEdit ? { cursor: 'pointer' } : undefined}
        onClick={canEdit ? () => setEditing(true) : undefined}
        onKeyDown={
          canEdit
            ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setEditing(true);
                }
              }
            : undefined
        }
      >
        {display ?? value}
      </span>
    );
  }
  return (
    <TextField
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
      autoFocus
      onChange={setDraft}
      onBlur={() => commit()}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

/**
 * A text field revealed in place of an "add" button: Enter submits,
 * Escape cancels, and losing focus commits what is there.
 */
export function InlineAddField(props: {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBlur: () => void;
  onCancel: () => void;
}) {
  return (
    <TextField
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
      autoFocus
      onBlur={props.onBlur}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          props.onSubmit();
        } else if (event.key === 'Escape') {
          props.onCancel();
        }
      }}
    />
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

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

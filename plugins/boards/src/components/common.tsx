import { useCallback, useEffect, useState } from 'react';
import { Badge, Flex, Text, TextField } from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { isTextRef, textRefDisplay } from '@internal/plugin-boards-common';
import { BlockToken, InlineToken, parseMarkdown } from './markdown';

/** Renders a creator/assignee/actor ref: catalog refs link, `text:` refs don't. */
export function RefDisplay(props: { refString: string }) {
  const { refString } = props;
  if (isTextRef(refString)) {
    return <span>{textRefDisplay(refString)}</span>;
  }
  return <EntityRefLink entityRef={refString} />;
}

export function RefChips(props: { refs: string[] }) {
  if (props.refs.length === 0) {
    return null;
  }
  return (
    <Flex gap="1" align="center" style={{ flexWrap: 'wrap' }}>
      {props.refs.map(ref => (
        <Badge key={ref} size="small">
          <RefDisplay refString={ref} />
        </Badge>
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

import { useState } from 'react';
import { Button, Checkbox, Flex, Text, TextField } from '@backstage/ui';
import { ChecklistEntry } from '@internal/plugin-boards-common';
import { InlineEdit } from './common';

/**
 * Compact `1/3` progress label for a card; success-colored once every
 * entry is done, nothing at all for items without a checklist.
 */
export function ChecklistBadge(props: { checklist?: ChecklistEntry[] }) {
  const total = props.checklist?.length ?? 0;
  if (total === 0) {
    return null;
  }
  const done = props.checklist!.filter(entry => entry.checked).length;
  const complete = done === total;
  return (
    <Text
      variant="body-x-small"
      color={complete ? undefined : 'secondary'}
      style={
        complete
          ? { color: 'var(--bui-fg-positive)', fontWeight: 600 }
          : undefined
      }
      data-checklist-state={complete ? 'complete' : 'in-progress'}
      aria-label={`Checklist: ${done} of ${total} done`}
    >
      ☑ {done}/{total}
    </Text>
  );
}

/**
 * The checklist as checkbox rows with click-to-edit labels, per-entry
 * removal and an always-present entry field — typing and Enter is all
 * adding takes. Without `canEdit` the rows render as plain read-only
 * state.
 */
export function ChecklistEditor(props: {
  checklist: ChecklistEntry[];
  canEdit: boolean;
  onChange: (checklist: ChecklistEntry[]) => Promise<void> | void;
}) {
  const { checklist, canEdit, onChange } = props;
  const [input, setInput] = useState('');

  const add = () => {
    const text = input.trim();
    if (text) {
      onChange([...checklist, { text, checked: false }]);
    }
    setInput('');
  };

  return (
    <Flex direction="column" gap="2">
      {checklist.length === 0 ? (
        <Text variant="body-small" color="secondary">
          No checklist yet.
        </Text>
      ) : (
        checklist.map((entry, index) => (
          // the list is replaced wholesale on every save, so the index
          // is as stable a key as the entries get
          // eslint-disable-next-line react/no-array-index-key
          <Flex key={index} align="center" gap="2">
            <Checkbox
              aria-label={`Mark "${entry.text}" as ${
                entry.checked ? 'not done' : 'done'
              }`}
              isSelected={entry.checked}
              isDisabled={!canEdit}
              onChange={checked =>
                onChange(
                  checklist.map((other, otherIndex) =>
                    otherIndex === index ? { ...other, checked } : other,
                  ),
                )
              }
            />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <InlineEdit
                value={entry.text}
                canEdit={canEdit}
                ariaLabel={`checklist entry ${entry.text}`}
                onCommit={text =>
                  onChange(
                    checklist.map((other, otherIndex) =>
                      otherIndex === index ? { ...other, text } : other,
                    ),
                  )
                }
                display={
                  <Text
                    variant="body-small"
                    color={entry.checked ? 'secondary' : undefined}
                    style={
                      entry.checked
                        ? { textDecoration: 'line-through' }
                        : undefined
                    }
                  >
                    {entry.text}
                  </Text>
                }
              />
            </div>
            {canEdit && (
              <Button
                variant="tertiary"
                size="small"
                aria-label={`Remove checklist entry ${entry.text}`}
                onPress={() =>
                  onChange(
                    checklist.filter((_, otherIndex) => otherIndex !== index),
                  )
                }
              >
                ✕
              </Button>
            )}
          </Flex>
        ))
      )}
      {canEdit && (
        <TextField
          aria-label="Add checklist entry"
          placeholder="Add checklist entry…"
          value={input}
          onChange={setInput}
          onBlur={add}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
      )}
    </Flex>
  );
}

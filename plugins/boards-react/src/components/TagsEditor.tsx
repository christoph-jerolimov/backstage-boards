import { useRef, useState } from 'react';
import {
  Button,
  Flex,
  SearchAutocomplete,
  SearchAutocompleteItem,
  Tag,
  TagGroup,
  Text,
} from '@backstage/ui';
import { normalizeTags } from '@internal/plugin-boards-common';

/**
 * Tag list with per-tag removal and an inline Add button that turns
 * into a search autocomplete, all on one wrapping row. Enter adds the
 * typed text directly; Escape closes the autocomplete and focuses the
 * Add button again.
 */
export function TagsEditor(props: {
  tags: string[];
  canEdit: boolean;
  /** Existing tags on the board offered as suggestions. */
  suggestions: string[];
  onChange: (tags: string[]) => Promise<void> | void;
}) {
  const { tags, canEdit, suggestions, onChange } = props;
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const add = (value: string) => {
    const [tag] = normalizeTags([value]);
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput('');
  };

  const closeToButton = () => {
    setAdding(false);
    setInput('');
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  const options = suggestions
    .filter(tag => !tags.includes(tag))
    .filter(
      tag =>
        !input ||
        tag
          .toLocaleLowerCase('en-US')
          .includes(input.toLocaleLowerCase('en-US')),
    )
    .sort();

  return (
    <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
      {tags.length > 0 ? (
        <TagGroup
          aria-label="Tags"
          onRemove={
            canEdit
              ? keys => onChange(tags.filter(tag => !keys.has(tag)))
              : undefined
          }
        >
          {tags.map(tag => (
            <Tag key={tag} id={tag} size="small">
              {tag}
            </Tag>
          ))}
        </TagGroup>
      ) : (
        <Text variant="body-small" color="secondary">
          No tags yet.
        </Text>
      )}
      {canEdit &&
        (adding ? (
          // Enter adds the typed tag directly; Escape returns to the
          // Add button. Capture phase so the autocomplete's own
          // key handling cannot swallow them.
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            onKeyDownCapture={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                add(input);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeToButton();
              }
            }}
          >
            <SearchAutocomplete
              aria-label="Add tag"
              placeholder="Add tag…"
              inputValue={input}
              onInputChange={setInput}
              defaultOpen={false}
            >
              {options.map(tag => (
                <SearchAutocompleteItem
                  key={tag}
                  id={tag}
                  onAction={() => add(tag)}
                >
                  {tag}
                </SearchAutocompleteItem>
              ))}
            </SearchAutocomplete>
          </div>
        ) : (
          <div>
            <Button
              ref={addButtonRef}
              aria-label="Add tag"
              variant="tertiary"
              size="small"
              onPress={() => setAdding(true)}
            >
              Add
            </Button>
          </div>
        ))}
    </Flex>
  );
}

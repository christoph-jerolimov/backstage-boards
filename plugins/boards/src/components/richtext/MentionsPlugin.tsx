import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import type { TextNode } from 'lexical';
import { useCatalogOptions } from '../useCatalogOptions';
import { $createMentionNode } from './MentionNode';

/**
 * Matches an in-progress `@…` mention behind the caret, permissive
 * enough for full refs (`@kind:namespace/name`) mid-typing.
 */
const TYPEAHEAD_PATTERN = /(?:^|[\s([{])(@([a-zA-Z0-9_.:/-]*))$/;

const MAX_SUGGESTIONS = 8;

class EntityOption extends MenuOption {
  constructor(readonly value: string, readonly label: string) {
    super(value);
  }
}

/**
 * Entity search autocompletion for mentions: typing `@` opens catalog
 * suggestions; picking one inserts an atomic mention token.
 */
export function MentionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const catalogOptions = useCatalogOptions({
    input: query ?? '',
    maxOptions: MAX_SUGGESTIONS,
  });

  const options = useMemo(
    () =>
      catalogOptions.map(
        option => new EntityOption(option.value, option.label),
      ),
    [catalogOptions],
  );

  const checkForMatch = useCallback((text: string): MenuTextMatch | null => {
    const match = TYPEAHEAD_PATTERN.exec(text);
    if (!match) {
      return null;
    }
    return {
      leadOffset: match.index + match[0].length - match[1].length,
      matchingString: match[2],
      replaceableString: match[1],
    };
  }, []);

  const onSelectOption = useCallback(
    (
      option: EntityOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const mention = $createMentionNode(option.value, `@${option.value}`);
        if (nodeToReplace) {
          nodeToReplace.replace(mention);
        }
        mention.selectNext(0, 0);
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<EntityOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={checkForMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorElementRef.current || options.length === 0) {
          return null;
        }
        return createPortal(
          <ul className="brt-mention-menu" role="listbox" aria-label="Entities">
            {options.map((option, index) => (
              <li
                key={option.key}
                role="option"
                aria-selected={selectedIndex === index}
                className={
                  selectedIndex === index
                    ? 'brt-mention-option brt-mention-option-selected'
                    : 'brt-mention-option'
                }
                ref={option.setRefElement}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={event => {
                  event.preventDefault();
                  selectOptionAndCleanUp(option);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          anchorElementRef.current,
        );
      }}
    />
  );
}

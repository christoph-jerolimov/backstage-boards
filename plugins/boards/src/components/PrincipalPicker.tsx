import { useMemo, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { Combobox } from '@backstage/ui';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { TEXT_REF_PREFIX } from '@internal/plugin-boards-common';
import { useAsyncData } from './common';

/**
 * Catalog-backed autocomplete for user/group refs. Selecting an option
 * calls `onSelect` and clears the input (add-one-at-a-time). With
 * `allowText`, the current input can be committed as a `text:` identity.
 */
export function PrincipalPicker(props: {
  ariaLabel: string;
  label?: string;
  placeholder?: string;
  allowText: boolean;
  exclude?: string[];
  onSelect: (ref: string) => void;
}) {
  const { ariaLabel, label, placeholder, allowText, exclude, onSelect } = props;
  const catalogApi = useApi(catalogApiRef);
  const [input, setInput] = useState('');

  const { data: entities } = useAsyncData(async () => {
    const response = await catalogApi.getEntities({
      filter: { kind: ['User', 'Group'] },
      fields: ['kind', 'metadata.namespace', 'metadata.name', 'metadata.title'],
    });
    return response.items;
  }, [catalogApi]);

  const options = useMemo(() => {
    const excluded = new Set(exclude ?? []);
    const catalogOptions = (entities ?? [])
      .map(entity => {
        const ref = stringifyEntityRef(entity);
        return {
          value: ref,
          label: `${entity.metadata.title ?? entity.metadata.name} (${ref})`,
        };
      })
      .filter(option => !excluded.has(option.value))
      .filter(
        option =>
          !input ||
          option.label
            .toLocaleLowerCase('en-US')
            .includes(input.toLocaleLowerCase('en-US')),
      )
      .sort((a, b) => a.label.localeCompare(b.label));
    const trimmed = input.trim();
    if (allowText && trimmed && !trimmed.startsWith(TEXT_REF_PREFIX)) {
      catalogOptions.push({
        value: `${TEXT_REF_PREFIX}${trimmed}`,
        label: `Use text “${trimmed}”`,
      });
    }
    return catalogOptions;
  }, [entities, exclude, input, allowText]);

  return (
    <Combobox
      aria-label={ariaLabel}
      label={label}
      placeholder={placeholder ?? 'Search users and groups…'}
      options={options}
      selectedKey={null}
      search={{
        inputValue: input,
        onInputChange: setInput,
        // options are pre-filtered against the input above
        filter: () => true,
      }}
      onSelectionChange={key => {
        if (key) {
          onSelect(String(key));
          setInput('');
        }
      }}
    />
  );
}

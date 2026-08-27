import { useMemo, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { Combobox } from '@backstage/ui';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useAsyncData } from './common';

/**
 * Catalog-backed autocomplete over all entities. Selecting an option
 * calls `onSelect` and clears the input (add-one-at-a-time).
 */
export function EntityPicker(props: {
  ariaLabel: string;
  label?: string;
  placeholder?: string;
  exclude?: string[];
  onSelect: (ref: string) => void;
}) {
  const { ariaLabel, label, placeholder, exclude, onSelect } = props;
  const catalogApi = useApi(catalogApiRef);
  const [input, setInput] = useState('');

  const { data: entities } = useAsyncData(async () => {
    const response = await catalogApi.getEntities({
      fields: ['kind', 'metadata.namespace', 'metadata.name', 'metadata.title'],
    });
    return response.items;
  }, [catalogApi]);

  const options = useMemo(() => {
    const excluded = new Set(exclude ?? []);
    return (entities ?? [])
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
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 100);
  }, [entities, exclude, input]);

  return (
    <Combobox
      aria-label={ariaLabel}
      label={label}
      placeholder={placeholder ?? 'Search catalog entities…'}
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

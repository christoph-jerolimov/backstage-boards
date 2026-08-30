import { useMemo, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { Combobox } from '@backstage/ui';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useQuery } from '@tanstack/react-query';
import { TEXT_REF_PREFIX } from '@internal/plugin-boards-common';

/**
 * Cache key for catalog lookups, which belong to no single board. The
 * same key the boards plugin has always used, so every picker on a page
 * shares one catalog fetch.
 */
const catalogEntitiesKey = (kinds?: string[]) =>
  ['boards', 'catalog-entities', kinds?.join(',') ?? 'all'] as const;

/** The entity fields the option labels are built from. */
const FIELDS = [
  'kind',
  'metadata.namespace',
  'metadata.name',
  'metadata.title',
];

/**
 * Catalog-backed autocomplete over entity refs. Selecting an option calls
 * `onSelect` and clears the input (add-one-at-a-time).
 *
 * Backs both {@link PrincipalPicker} and {@link EntityPicker}: `kinds`
 * narrows the catalog query, `allowText` offers the current input as a
 * `text:` identity.
 */
export function CatalogRefPicker(props: {
  ariaLabel: string;
  label?: string;
  placeholder: string;
  /** Restricts the query to these entity kinds; all kinds when omitted. */
  kinds?: string[];
  /** Offers the typed input as a `text:` identity. */
  allowText?: boolean;
  /** Caps the number of catalog options; the catalog can be large. */
  maxOptions?: number;
  exclude?: string[];
  onSelect: (ref: string) => void;
}) {
  const { ariaLabel, label, placeholder, kinds, allowText, maxOptions } = props;
  const { exclude, onSelect } = props;
  const catalogApi = useApi(catalogApiRef);
  const [input, setInput] = useState('');

  const { data: entities } = useQuery({
    queryKey: catalogEntitiesKey(kinds),
    // the catalog changes far more slowly than a picker is opened
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await catalogApi.getEntities({
        ...(kinds ? { filter: { kind: kinds } } : {}),
        fields: FIELDS,
      });
      return response.items;
    },
  });

  const options = useMemo(() => {
    const excluded = new Set(exclude ?? []);
    const needle = input.toLocaleLowerCase('en-US');
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
          !input || option.label.toLocaleLowerCase('en-US').includes(needle),
      )
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, maxOptions ?? Infinity);
    const trimmed = input.trim();
    if (allowText && trimmed && !trimmed.startsWith(TEXT_REF_PREFIX)) {
      catalogOptions.push({
        value: `${TEXT_REF_PREFIX}${trimmed}`,
        label: `Use text “${trimmed}”`,
      });
    }
    return catalogOptions;
  }, [entities, exclude, input, allowText, maxOptions]);

  return (
    <Combobox
      aria-label={ariaLabel}
      label={label}
      placeholder={placeholder}
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

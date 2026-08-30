import { useMemo, useState } from 'react';
import { Combobox } from '@backstage/ui';
import { TEXT_REF_PREFIX } from '@internal/plugin-boards-common';
import { useCatalogOptions } from './useCatalogOptions';

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
  const [input, setInput] = useState('');
  const catalogOptions = useCatalogOptions({
    input,
    kinds,
    maxOptions,
    exclude,
  });

  const options = useMemo(() => {
    const trimmed = input.trim();
    if (allowText && trimmed && !trimmed.startsWith(TEXT_REF_PREFIX)) {
      return [
        ...catalogOptions,
        {
          value: `${TEXT_REF_PREFIX}${trimmed}`,
          label: `Use text “${trimmed}”`,
        },
      ];
    }
    return catalogOptions;
  }, [catalogOptions, input, allowText]);

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

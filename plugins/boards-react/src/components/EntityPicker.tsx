import { CatalogRefPicker } from './CatalogRefPicker';

/** The catalog can be large, so the option list is capped. */
const MAX_OPTIONS = 100;

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
  return (
    <CatalogRefPicker
      ariaLabel={props.ariaLabel}
      label={props.label}
      placeholder={props.placeholder ?? 'Search catalog entities…'}
      maxOptions={MAX_OPTIONS}
      exclude={props.exclude}
      onSelect={props.onSelect}
    />
  );
}

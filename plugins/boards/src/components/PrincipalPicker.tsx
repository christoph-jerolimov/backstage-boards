import { CatalogRefPicker } from './CatalogRefPicker';

const PRINCIPAL_KINDS = ['User', 'Group'];

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
  return (
    <CatalogRefPicker
      ariaLabel={props.ariaLabel}
      label={props.label}
      placeholder={props.placeholder ?? 'Search users and groups…'}
      kinds={PRINCIPAL_KINDS}
      allowText={props.allowText}
      exclude={props.exclude}
      onSelect={props.onSelect}
    />
  );
}

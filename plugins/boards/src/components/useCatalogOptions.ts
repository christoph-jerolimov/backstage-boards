import { useMemo } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queries';

/** The entity fields the option labels are built from. */
const FIELDS = [
  'kind',
  'metadata.namespace',
  'metadata.name',
  'metadata.title',
];

export type CatalogOption = { value: string; label: string };

/**
 * Catalog entities as picker options (`value` is the full entity ref),
 * cached briefly and filtered client-side against `input`. Shared by
 * {@link CatalogRefPicker} and the rich-text mention autocompletion.
 */
export function useCatalogOptions(options: {
  input: string;
  /** Restricts the query to these entity kinds; all kinds when omitted. */
  kinds?: string[];
  /** Caps the number of options; the catalog can be large. */
  maxOptions?: number;
  exclude?: string[];
}): CatalogOption[] {
  const { input, kinds, maxOptions, exclude } = options;
  const catalogApi = useApi(catalogApiRef);

  const { data: entities } = useQuery({
    queryKey: queryKeys.catalogEntities(kinds),
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

  return useMemo(() => {
    const excluded = new Set(exclude ?? []);
    const needle = input.toLocaleLowerCase('en-US');
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
          !input || option.label.toLocaleLowerCase('en-US').includes(needle),
      )
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, maxOptions ?? Infinity);
  }, [entities, exclude, input, maxOptions]);
}

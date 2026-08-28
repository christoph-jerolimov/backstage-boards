import { useMemo } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useQuery } from '@tanstack/react-query';
import { refDisplayName } from '@internal/plugin-boards-common';

export interface Profile {
  displayName: string;
  picture?: string;
}

/**
 * Batch-resolves display names and pictures for catalog assignee refs.
 * Shared by the card avatars and the assignee filter so both label the
 * same person the same way.
 */
export function useProfiles(entityRefs: string[]): Map<string, Profile> {
  const catalogApi = useApi(catalogApiRef);
  const sorted = useMemo(() => [...entityRefs].sort(), [entityRefs]);
  const { data } = useQuery({
    queryKey: ['boards', 'profiles', ...sorted],
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () =>
      catalogApi.getEntitiesByRefs({
        entityRefs: sorted,
        fields: ['kind', 'metadata', 'spec.profile'],
      }),
  });
  return useMemo(() => {
    const profiles = new Map<string, Profile>();
    sorted.forEach((ref, index) => {
      const entity = data?.items[index];
      const profile = entity?.spec?.profile as
        | { displayName?: string; picture?: string }
        | undefined;
      profiles.set(ref, {
        displayName:
          profile?.displayName ??
          entity?.metadata.title ??
          entity?.metadata.name ??
          refDisplayName(ref),
        picture: profile?.picture,
      });
    });
    return profiles;
  }, [sorted, data]);
}

import { useMemo } from 'react';
import {
  Avatar,
  Badge,
  Flex,
  Focusable,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@backstage/ui';
import { useApi } from '@backstage/frontend-plugin-api';
import { catalogApiRef, EntityRefLink } from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { useQuery } from '@tanstack/react-query';
import { isTextRef, textRefDisplay } from '@internal/plugin-boards-common';

const STACK_CLASS = 'boards-avatar-stack';

/* Hover/focus needs pseudo-classes, which inline styles can't express. */
const STACK_STYLES = `
.${STACK_CLASS} {
  display: inline-flex;
  align-items: center;
}
.${STACK_CLASS} a {
  display: inline-flex;
  border-radius: 50%;
  position: relative;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.${STACK_CLASS}[data-stacked] > * + * {
  margin-left: -8px;
}
.${STACK_CLASS}[data-stacked] .bui-AvatarRoot {
  box-shadow: 0 0 0 2px var(--bui-bg-neutral-1);
}
.${STACK_CLASS} a:hover,
.${STACK_CLASS} a:focus-visible {
  transform: scale(1.2);
  z-index: 1;
  box-shadow: 0 0 0 2px var(--bui-fg-link);
}
`;

let stylesInjected = false;
function ensureStackStyles(): void {
  if (stylesInjected || typeof document === 'undefined') {
    return;
  }
  const element = document.createElement('style');
  element.textContent = STACK_STYLES;
  document.head.appendChild(element);
  stylesInjected = true;
}

interface Profile {
  displayName: string;
  picture?: string;
}

function refFallbackName(ref: string): string {
  try {
    return parseEntityRef(ref).name;
  } catch {
    return ref;
  }
}

/** Batch-resolves display names and pictures for catalog assignee refs. */
function useProfiles(entityRefs: string[]): Map<string, Profile> {
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
          refFallbackName(ref),
        picture: profile?.picture,
      });
    });
    return profiles;
  }, [sorted, data]);
}

function AvatarLink(props: {
  entityRef: string;
  profile: Profile;
  withTooltip: boolean;
}) {
  const { entityRef, profile, withTooltip } = props;
  const avatar = (
    <EntityRefLink entityRef={entityRef} hideIcon disableTooltip>
      <Avatar
        src={profile.picture ?? ''}
        name={profile.displayName}
        size="x-small"
        purpose={withTooltip ? 'informative' : 'decoration'}
      />
    </EntityRefLink>
  );
  if (!withTooltip) {
    return avatar;
  }
  return (
    <TooltipTrigger>
      <Focusable>
        <span style={{ display: 'inline-flex' }}>{avatar}</span>
      </Focusable>
      <Tooltip>{profile.displayName}</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Renders assignees: `user:`/`group:` refs as avatars (one avatar plus
 * name; several as an overlapping stack with name tooltips), `text:`
 * refs as plain badges.
 */
export function AssigneeAvatars(props: { refs: string[] }) {
  const entityRefs = props.refs.filter(ref => !isTextRef(ref));
  const textRefs = props.refs.filter(ref => isTextRef(ref));
  const profiles = useProfiles(entityRefs);

  if (props.refs.length === 0) {
    return null;
  }
  ensureStackStyles();
  const stacked = entityRefs.length > 1;
  return (
    <Flex gap="1" align="center" style={{ flexWrap: 'wrap' }}>
      {entityRefs.length > 0 && (
        // clicking an avatar must navigate, not open the card's drawer
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <span
          className={STACK_CLASS}
          data-stacked={stacked || undefined}
          onClick={event => event.stopPropagation()}
        >
          {entityRefs.map(ref => (
            <AvatarLink
              key={ref}
              entityRef={ref}
              profile={
                profiles.get(ref) ?? { displayName: refFallbackName(ref) }
              }
              withTooltip={stacked}
            />
          ))}
        </span>
      )}
      {entityRefs.length === 1 && (
        <Text variant="body-x-small">
          {profiles.get(entityRefs[0])?.displayName ??
            refFallbackName(entityRefs[0])}
        </Text>
      )}
      {textRefs.map(ref => (
        <Badge key={ref} size="small">
          {textRefDisplay(ref)}
        </Badge>
      ))}
    </Flex>
  );
}

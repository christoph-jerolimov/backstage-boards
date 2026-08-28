import {
  Avatar,
  Badge,
  Flex,
  Focusable,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import {
  isTextRef,
  refDisplayName,
  textRefDisplay,
} from '@internal/plugin-boards-common';
import { Profile, useProfiles } from './useProfiles';

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
  // an avatar in a stack shows initials only, so its tooltip carries the
  // name as well as the ref
  return (
    <TooltipTrigger>
      <Focusable>
        <span style={{ display: 'inline-flex' }}>{avatar}</span>
      </Focusable>
      <Tooltip>
        {profile.displayName}
        <br />
        {entityRef}
      </Tooltip>
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
                profiles.get(ref) ?? { displayName: refDisplayName(ref) }
              }
              withTooltip={stacked}
            />
          ))}
        </span>
      )}
      {entityRefs.length === 1 && (
        // clicking the name navigates to the entity, not the drawer
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <span onClick={event => event.stopPropagation()}>
          <Text variant="body-x-small">
            {/* the ref as a native title: no extra tab stop around the link */}
            <span title={entityRefs[0]}>
              <EntityRefLink entityRef={entityRefs[0]} hideIcon disableTooltip>
                {profiles.get(entityRefs[0])?.displayName ??
                  refDisplayName(entityRefs[0])}
              </EntityRefLink>
            </span>
          </Text>
        </span>
      )}
      {textRefs.map(ref => (
        <Badge key={ref} size="small">
          {textRefDisplay(ref)}
        </Badge>
      ))}
    </Flex>
  );
}

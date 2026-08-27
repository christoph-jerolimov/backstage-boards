import {
  BoardPermissionLevel,
  BoardVisibility,
  maxLevel,
  TEXT_REF_PREFIX,
} from '@internal/plugin-boards-common';

/**
 * The identity a request or action invocation acts as, resolved from
 * Backstage credentials.
 */
export type BoardsPrincipal =
  | { type: 'user'; userRef: string; ownershipRefs: string[] }
  | { type: 'service'; subject: string }
  | { type: 'anonymous' };

/** The ref recorded as actor for audit fields, changes, and comments. */
export function actorRef(principal: BoardsPrincipal): string {
  switch (principal.type) {
    case 'user':
      return principal.userRef;
    case 'service':
      return `${TEXT_REF_PREFIX}${principal.subject}`;
    case 'anonymous':
      return `${TEXT_REF_PREFIX}anonymous`;
    default:
      throw new Error('unknown principal');
  }
}

/**
 * The level granted by a board's visibility alone. Public and logged-in
 * modes never grant admin.
 */
export function visibilityLevel(
  visibility: BoardVisibility,
  principal: BoardsPrincipal,
): BoardPermissionLevel | undefined {
  switch (visibility) {
    case 'public-read':
      return 'read';
    case 'public-write':
      return 'write';
    case 'logged-in-read':
      return principal.type === 'user' ? 'read' : undefined;
    case 'logged-in-write':
      return principal.type === 'user' ? 'write' : undefined;
    case 'private':
    default:
      return undefined;
  }
}

/**
 * Computes the effective permission level of a principal on a board:
 * the highest of the visibility-derived level, a direct user grant, and
 * grants to any of the user's ownership groups. Service principals act
 * with full access (integrations and actions callers).
 */
export function computeEffectiveLevel(options: {
  principal: BoardsPrincipal;
  visibility: BoardVisibility;
  entries: Array<{ principalRef: string; level: BoardPermissionLevel }>;
}): BoardPermissionLevel | undefined {
  const { principal, visibility, entries } = options;

  if (principal.type === 'service') {
    return 'admin';
  }

  let level = visibilityLevel(visibility, principal);

  if (principal.type === 'user') {
    const refs = new Set([principal.userRef, ...principal.ownershipRefs]);
    for (const entry of entries) {
      if (refs.has(entry.principalRef)) {
        level = maxLevel(level, entry.level);
      }
    }
  }

  return level;
}

import { parseEntityRef } from '@backstage/catalog-model';
import { BoardPermissionLevel, BoardVisibility } from './types';

/**
 * Prefix marking a free-text (non-catalog) identity, e.g. `text:Jane (agency)`.
 */
export const TEXT_REF_PREFIX = 'text:';

export function isTextRef(ref: string): boolean {
  return ref.startsWith(TEXT_REF_PREFIX);
}

/** The display value of a `text:` ref, or undefined for catalog refs. */
export function textRefDisplay(ref: string): string | undefined {
  return isTextRef(ref) ? ref.slice(TEXT_REF_PREFIX.length) : undefined;
}

/**
 * Validates a creator/assignee reference: either a `text:` ref with
 * non-empty content, or a syntactically valid catalog entity ref.
 */
export function isValidActorRef(ref: string): boolean {
  if (isTextRef(ref)) {
    return ref.slice(TEXT_REF_PREFIX.length).trim().length > 0;
  }
  try {
    parseEntityRef(ref);
    return true;
  } catch {
    return false;
  }
}

/** Validates a share principal: must be a `user:` or `group:` entity ref. */
export function isValidPrincipalRef(ref: string): boolean {
  if (isTextRef(ref)) {
    return false;
  }
  try {
    const parsed = parseEntityRef(ref);
    return ['user', 'group'].includes(parsed.kind.toLocaleLowerCase('en-US'));
  } catch {
    return false;
  }
}

const LEVEL_RANK: Record<BoardPermissionLevel, number> = {
  read: 1,
  write: 2,
  admin: 3,
};

/** True if `level` includes at least the rights of `required`. */
export function levelIncludes(
  level: BoardPermissionLevel | undefined,
  required: BoardPermissionLevel,
): boolean {
  return !!level && LEVEL_RANK[level] >= LEVEL_RANK[required];
}

/** The higher of two permission levels. */
export function maxLevel(
  a: BoardPermissionLevel | undefined,
  b: BoardPermissionLevel | undefined,
): BoardPermissionLevel | undefined {
  if (!a) return b;
  if (!b) return a;
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export const ALL_VISIBILITIES: BoardVisibility[] = [
  'private',
  'logged-in-read',
  'logged-in-write',
  'public-read',
  'public-write',
];

export const ALL_LEVELS: BoardPermissionLevel[] = ['read', 'write', 'admin'];

/**
 * @-mention extraction shared by the backend (notifications) and the
 * frontend renderer. Supported forms, at the start of the text or after
 * whitespace:
 *
 * - `@component:webserver-example`, `@group:default/another-team` (full
 *   entity refs of any catalog kind, namespace defaulting to `default`)
 * - `@jane` shorthand, resolved as `user:default/jane`
 */

// The trailing \b keeps sentence punctuation out of the ref: entity
// names end alphanumeric, so `@group:default/guests.` mentions `guests`.
const MENTION_PATTERN =
  /(^|[\s([{])@([a-zA-Z][a-zA-Z0-9]*:(?:[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+)\b/g;

/**
 * Prefixes that look like an entity kind but are not; neither mentions
 * nor bare-ref auto-linking treat them as refs.
 */
export const NON_ENTITY_KINDS: ReadonlySet<string> = new Set([
  'text',
  'http',
  'https',
  'mailto',
]);

/** Resolves the ref part of a mention to a full entity ref. */
export function resolveMentionRef(raw: string): string {
  if (raw.includes(':')) {
    const [kind, rest] = raw.split(':', 2);
    return rest.includes('/') ? `${kind}:${rest}` : `${kind}:default/${rest}`;
  }
  return `user:default/${raw}`;
}

function isEntityMention(raw: string): boolean {
  const colon = raw.indexOf(':');
  if (colon === -1) {
    return true; // shorthand
  }
  return !NON_ENTITY_KINDS.has(raw.slice(0, colon).toLocaleLowerCase('en-US'));
}

/**
 * All principals (users and groups) mentioned in a text, deduplicated,
 * in order. Mentions of other entity kinds render as links but are not
 * principals, so they are not returned here.
 */
export function extractMentions(text: string): string[] {
  const refs: string[] = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    if (!isEntityMention(match[2])) {
      continue;
    }
    const ref = resolveMentionRef(match[2]);
    if (!ref.startsWith('user:') && !ref.startsWith('group:')) {
      continue;
    }
    if (!refs.includes(ref)) {
      refs.push(ref);
    }
  }
  return refs;
}

/**
 * Positions of mentions within a text, for renderers. Each entry covers
 * the `@...` sequence including the `@`.
 */
export function findMentions(
  text: string,
): Array<{ start: number; end: number; entityRef: string; display: string }> {
  const result: Array<{
    start: number;
    end: number;
    entityRef: string;
    display: string;
  }> = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    if (!isEntityMention(match[2])) {
      continue;
    }
    const prefixLength = match[1].length;
    const start = match.index! + prefixLength;
    result.push({
      start,
      end: start + match[0].length - prefixLength,
      entityRef: resolveMentionRef(match[2]),
      display: `@${match[2]}`,
    });
  }
  return result;
}

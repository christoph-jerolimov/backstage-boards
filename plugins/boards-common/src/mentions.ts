/**
 * @-mention extraction shared by the backend (notifications) and the
 * frontend renderer. Supported forms, at the start of the text or after
 * whitespace:
 *
 * - `@user:default/jane`, `@group:default/team-a` (full entity refs,
 *   user/group kinds only)
 * - `@jane` shorthand, resolved as `user:default/jane`
 */

const MENTION_PATTERN =
  /(^|[\s([{])@((?:user|group):(?:[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+)/g;

/** Resolves the ref part of a mention to a full user/group entity ref. */
export function resolveMentionRef(raw: string): string {
  if (raw.includes(':')) {
    const [kind, rest] = raw.split(':', 2);
    return rest.includes('/') ? `${kind}:${rest}` : `${kind}:default/${rest}`;
  }
  return `user:default/${raw}`;
}

/** All principals mentioned in a text, deduplicated, in order. */
export function extractMentions(text: string): string[] {
  const refs: string[] = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const ref = resolveMentionRef(match[2]);
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

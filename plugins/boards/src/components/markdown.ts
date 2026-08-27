/**
 * A small, safe markdown-subset tokenizer used for comments. Raw HTML is
 * never emitted; the renderer builds React elements from these tokens.
 *
 * Supported: **bold**, *italic* / _italic_, `inline code`, fenced code
 * blocks, [links](https://...), unordered/ordered lists, paragraphs, and
 * automatic linking of catalog entity refs such as `system:default/example`
 * or `user:christoph`. Refs with the `text:` prefix are never linked.
 */

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineToken[] }
  | { type: 'entity'; entityRef: string };

import { findMentions } from '@internal/plugin-boards-common';

export type BlockToken =
  | { type: 'paragraph'; children: InlineToken[] }
  | { type: 'codeBlock'; value: string }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] };

// kind:namespace/name or kind:name or namespace/name, per catalog ref
// shorthand rules. `text:` is explicitly excluded from linking.
const ENTITY_REF_PATTERN =
  /\b([a-zA-Z][a-zA-Z0-9]*):(?:([a-zA-Z0-9_.-]+)\/)?([a-zA-Z0-9_.-]+)\b/g;

const NON_ENTITY_PREFIXES = new Set(['text', 'http', 'https', 'mailto']);

function autolinkBareRefs(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(ENTITY_REF_PATTERN)) {
    const [full, kind] = match;
    if (NON_ENTITY_PREFIXES.has(kind.toLocaleLowerCase('en-US'))) {
      continue;
    }
    if (match.index! > last) {
      tokens.push({ type: 'text', value: text.slice(last, match.index) });
    }
    tokens.push({ type: 'entity', entityRef: full });
    last = match.index! + full.length;
  }
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) });
  }
  return tokens;
}

/**
 * Splits plain text into text tokens, @-mention links, and auto-linked
 * bare entity refs.
 */
export function autolinkEntities(text: string): InlineToken[] {
  const mentions = findMentions(text);
  if (mentions.length === 0) {
    return autolinkBareRefs(text);
  }
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const mention of mentions) {
    if (mention.start > last) {
      tokens.push(...autolinkBareRefs(text.slice(last, mention.start)));
    }
    tokens.push({ type: 'entity', entityRef: mention.entityRef });
    last = mention.end;
  }
  if (last < text.length) {
    tokens.push(...autolinkBareRefs(text.slice(last)));
  }
  return tokens;
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  const patterns: Array<{
    regex: RegExp;
    build: (match: RegExpMatchArray) => InlineToken;
  }> = [
    {
      regex: /`([^`]+)`/,
      build: match => ({ type: 'code', value: match[1] }),
    },
    {
      regex: /\*\*([^*]+)\*\*/,
      build: match => ({ type: 'bold', children: parseInline(match[1]) }),
    },
    {
      regex: /\*([^*]+)\*/,
      build: match => ({ type: 'italic', children: parseInline(match[1]) }),
    },
    {
      regex: /\b_([^_]+)_\b/,
      build: match => ({ type: 'italic', children: parseInline(match[1]) }),
    },
    {
      regex: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/,
      build: match => ({
        type: 'link',
        href: match[2],
        children: [{ type: 'text', value: match[1] }],
      }),
    },
  ];

  while (remaining.length > 0) {
    let earliest:
      | {
          index: number;
          match: RegExpMatchArray;
          build: (m: RegExpMatchArray) => InlineToken;
        }
      | undefined;
    for (const { regex, build } of patterns) {
      const match = remaining.match(regex);
      if (match && (earliest === undefined || match.index! < earliest.index)) {
        earliest = { index: match.index!, match, build };
      }
    }
    if (!earliest) {
      tokens.push(...autolinkEntities(remaining));
      break;
    }
    if (earliest.index > 0) {
      tokens.push(...autolinkEntities(remaining.slice(0, earliest.index)));
    }
    tokens.push(earliest.build(earliest.match));
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return tokens;
}

export function parseMarkdown(text: string): BlockToken[] {
  const blocks: BlockToken[] = [];
  const lines = text.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !lines[index].trimStart().startsWith('```')
      ) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({ type: 'codeBlock', value: codeLines.join('\n') });
      continue;
    }

    const listMatch = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /^\d+\.$/.test(listMatch[1]);
      const items: InlineToken[][] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(parseInline(itemMatch[2]));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !lines[index].trimStart().startsWith('```') &&
      !lines[index].match(/^\s*([-*]|\d+\.)\s+/)
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({
      type: 'paragraph',
      children: parseInline(paragraphLines.join(' ')),
    });
  }

  return blocks;
}

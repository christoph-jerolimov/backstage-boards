/**
 * A small, safe markdown-subset tokenizer used for comments. Raw HTML is
 * never emitted; the renderer builds React elements from these tokens.
 *
 * Supported: **bold**, *italic* / _italic_, `inline code`, fenced code
 * blocks, [links](https://...), unordered/ordered lists, ATX headings,
 * GitHub pipe tables, paragraphs, and automatic linking of catalog entity
 * refs such as `system:default/example` or `user:christoph`. Refs with
 * the `text:` prefix are never linked.
 */

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineToken[] }
  | { type: 'entity'; entityRef: string };

import { findMentions, NON_ENTITY_KINDS } from '@internal/plugin-boards-common';

export type BlockToken =
  | { type: 'paragraph'; children: InlineToken[] }
  | { type: 'codeBlock'; value: string }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'heading'; level: number; children: InlineToken[] }
  | { type: 'table'; header: InlineToken[][]; rows: InlineToken[][][] };

// kind:namespace/name or kind:name or namespace/name, per catalog ref
// shorthand rules. `text:` is explicitly excluded from linking.
const ENTITY_REF_PATTERN =
  /\b([a-zA-Z][a-zA-Z0-9]*):(?:([a-zA-Z0-9_.-]+)\/)?([a-zA-Z0-9_.-]+)\b/g;

function autolinkBareRefs(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(ENTITY_REF_PATTERN)) {
    const [full, kind] = match;
    if (NON_ENTITY_KINDS.has(kind.toLocaleLowerCase('en-US'))) {
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

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

// `| --- | :---: |`-style separator row that turns the preceding pipe
// line into a table header. Alignment colons are tolerated but ignored.
function isTableSeparator(line: string): boolean {
  return (
    line.includes('|') &&
    /^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(line)
  );
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) {
    row = row.slice(1);
  }
  if (row.endsWith('|')) {
    row = row.slice(0, -1);
  }
  return row.split('|').map(cell => cell.trim());
}

function startsTable(lines: string[], index: number): boolean {
  return (
    lines[index].includes('|') &&
    index + 1 < lines.length &&
    isTableSeparator(lines[index + 1])
  );
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

    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        children: parseInline(headingMatch[2].trim()),
      });
      index += 1;
      continue;
    }

    if (startsTable(lines, index)) {
      const header = splitTableRow(line).map(parseInline);
      index += 2; // header and separator rows
      const rows: InlineToken[][][] = [];
      while (index < lines.length && lines[index].includes('|')) {
        const cells = splitTableRow(lines[index]);
        rows.push(header.map((_, cell) => parseInline(cells[cell] ?? '')));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
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
      !lines[index].match(/^\s*([-*]|\d+\.)\s+/) &&
      !lines[index].match(HEADING_PATTERN) &&
      !startsTable(lines, index)
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

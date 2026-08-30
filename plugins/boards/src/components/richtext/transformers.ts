/**
 * The markdown dialect of the boards plugin: the standard Lexical
 * transformers for the supported element subset plus custom ones for
 * `@…` mentions, bare catalog entity refs, `#tags`, and pipe tables.
 * Markdown stays the storage format — these transformers are the only
 * boundary between it and the editor.
 */
import {
  $convertToMarkdownString,
  $generateNodesFromMarkdownString,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CODE,
  HEADING,
  INLINE_CODE,
  isTableRowDivider,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  UNORDERED_LIST,
  type ElementTransformer,
  type TextMatchTransformer,
  type Transformer,
} from '@lexical/markdown';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $createHashtagNode, HashtagNode } from '@lexical/hashtag';
import { $createParagraphNode, $isElementNode, $nodesOfType } from 'lexical';
import {
  NON_ENTITY_KINDS,
  resolveMentionRef,
} from '@internal/plugin-boards-common';
import { $createMentionNode, $isMentionNode, MentionNode } from './MentionNode';

/** `@ref` mentions: shorthand or full entity ref of any catalog kind. */
const MENTION_IMPORT_PATTERN =
  /(?<=^|[\s([{])@(?!(?:text|http|https|mailto):)([a-zA-Z][a-zA-Z0-9]*:(?:[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+)\b/;

export const MENTION: TextMatchTransformer = {
  dependencies: [MentionNode],
  export: node => ($isMentionNode(node) ? node.getLabel() : null),
  importRegExp: MENTION_IMPORT_PATTERN,
  // while typing, a completed mention converts once a space follows it
  regExp: new RegExp(`${MENTION_IMPORT_PATTERN.source}$`),
  trigger: ' ',
  replace: (textNode, match) => {
    textNode.replace($createMentionNode(resolveMentionRef(match[1]), match[0]));
  },
  type: 'text-match',
};

/** Bare `kind:namespace/name` refs auto-link, `text:` refs never do. */
const ENTITY_REF_IMPORT_PATTERN =
  /(?<![\w@:/])([a-zA-Z][a-zA-Z0-9]*):(?:[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+\b/;

export const ENTITY_REF: TextMatchTransformer = {
  dependencies: [MentionNode],
  // export is covered by MENTION: every mention node exports its label
  importRegExp: ENTITY_REF_IMPORT_PATTERN,
  regExp: new RegExp(`${ENTITY_REF_IMPORT_PATTERN.source}$`),
  replace: (textNode, match) => {
    if (NON_ENTITY_KINDS.has(match[1].toLocaleLowerCase('en-US'))) {
      return;
    }
    textNode.replace($createMentionNode(match[0], match[0]));
  },
  type: 'text-match',
};

/** `#tags` become highlighted hashtag text; they export as-is. */
export const HASHTAG: TextMatchTransformer = {
  dependencies: [HashtagNode],
  importRegExp: /(?<=^|\s)#[a-zA-Z0-9_][a-zA-Z0-9_-]*\b/,
  regExp: /(?<=^|\s)#[a-zA-Z0-9_][a-zA-Z0-9_-]*\b$/,
  replace: textNode => {
    textNode.replace($createHashtagNode(textNode.getTextContent()));
  },
  type: 'text-match',
};

/** Inline + block transformers valid inside a table cell (no nesting). */
const CELL_TRANSFORMERS: Transformer[] = [
  CODE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  INLINE_CODE,
  LINK,
  MENTION,
  ENTITY_REF,
  HASHTAG,
];

const TABLE_ROW_PATTERN = /^\|(.+)\|\s*$/;

function tableCellMarkdown(cell: TableCellNode): string {
  return $convertToMarkdownString(CELL_TRANSFORMERS, cell)
    .replace(/\n+/g, ' ')
    .trim();
}

function $createTableCell(text: string): TableCellNode {
  const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  const nodes = $generateNodesFromMarkdownString(
    text.trim(),
    CELL_TRANSFORMERS,
  );
  if (nodes.length === 0) {
    cell.append($createParagraphNode());
  } else {
    cell.append(...nodes);
  }
  return cell;
}

/**
 * GitHub-style pipe tables (after the Lexical playground's transformer):
 * each `| … |` row appends to the table built by the preceding rows, and
 * the `| --- |` divider row turns the row above it into the header.
 */
export const TABLE: ElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: node => {
    if (!$isTableNode(node)) {
      return null;
    }
    const lines: string[] = [];
    for (const row of node.getChildren()) {
      if (!$isTableRowNode(row)) {
        continue;
      }
      const cells = row.getChildren().filter($isTableCellNode);
      lines.push(`| ${cells.map(tableCellMarkdown).join(' | ')} |`);
      const isHeader = cells.some(
        cell => cell.getHeaderStyles() & TableCellHeaderStates.ROW,
      );
      if (isHeader && lines.length === 1) {
        lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
      }
    }
    return lines.join('\n');
  },
  regExp: TABLE_ROW_PATTERN,
  replace: (parentNode, _children, match) => {
    // the divider row promotes the row above it to the table header
    if (isTableRowDivider(match[0])) {
      const table = parentNode.getPreviousSibling();
      if (!$isTableNode(table)) {
        return false;
      }
      const lastRow = table.getLastChild();
      if (!$isTableRowNode(lastRow)) {
        return false;
      }
      for (const cell of lastRow.getChildren()) {
        if ($isTableCellNode(cell)) {
          cell.setHeaderStyles(
            TableCellHeaderStates.ROW,
            TableCellHeaderStates.ROW,
          );
        }
      }
      parentNode.remove();
      return true;
    }
    const cells = match[1].split('|').map($createTableCell);
    const row = $createTableRowNode();
    row.append(...cells);
    const previous = parentNode.getPreviousSibling();
    if ($isTableNode(previous)) {
      previous.append(row);
      parentNode.remove();
    } else {
      const table = $createTableNode();
      table.append(row);
      parentNode.replace(table);
    }
    return true;
  },
  type: 'element',
};

/**
 * Reverts imported tables that never saw a divider row back to their
 * literal text: a pipe line without a `| --- |` row below it is a
 * paragraph, not a table (matching the rendering the plugin always had).
 */
export function $normalizeImportedTables(): void {
  for (const table of $nodesOfType(TableNode)) {
    const firstRow = table.getFirstChild();
    if (!$isTableRowNode(firstRow)) {
      continue;
    }
    const hasHeader = firstRow
      .getChildren()
      .filter($isTableCellNode)
      .some(cell => cell.getHeaderStyles() & TableCellHeaderStates.ROW);
    if (hasHeader) {
      continue;
    }
    const exported = TABLE.export(table, () => '');
    for (const line of (exported ?? '').split('\n')) {
      const paragraph = $createParagraphNode();
      paragraph.append(
        ...$generateNodesFromMarkdownString(line, CELL_TRANSFORMERS).flatMap(
          node => ($isElementNode(node) ? node.getChildren() : [node]),
        ),
      );
      table.insertBefore(paragraph);
    }
    table.remove();
  }
}

/**
 * The full dialect. Deliberately excludes quote/checklist/strikethrough:
 * the plugin's markdown subset never had them, so such text stays plain.
 */
export const BOARDS_TRANSFORMERS: Transformer[] = [
  TABLE,
  HEADING,
  UNORDERED_LIST,
  ORDERED_LIST,
  ...CELL_TRANSFORMERS,
];

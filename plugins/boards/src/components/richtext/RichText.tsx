import { useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { EditorState, Klass, LexicalEditor, LexicalNode } from 'lexical';
import { $nodesOfType } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { MentionNode } from './MentionNode';
import { MentionsPlugin } from './MentionsPlugin';
import { $normalizeImportedTables, BOARDS_TRANSFORMERS } from './transformers';

export const RICH_TEXT_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  HashtagNode,
  MentionNode,
];

const THEME = {
  paragraph: 'brt-p',
  quote: 'brt-p',
  heading: {
    h1: 'brt-h brt-h1',
    h2: 'brt-h brt-h2',
    h3: 'brt-h brt-h3',
    h4: 'brt-h brt-h4',
    h5: 'brt-h brt-h5',
    h6: 'brt-h brt-h6',
  },
  list: { ul: 'brt-ul', ol: 'brt-ol', listitem: 'brt-li' },
  code: 'brt-codeblock',
  text: { bold: 'brt-bold', italic: 'brt-italic', code: 'brt-code' },
  link: 'brt-link',
  hashtag: 'brt-hashtag',
  table: 'brt-table',
  tableRow: 'brt-tr',
  tableCell: 'brt-td',
  tableCellHeader: 'brt-th',
};

// One stylesheet for editor and viewer, at drawer scale (a `# h1` in a
// comment must not dwarf the page chrome), from design-system tokens.
const STYLES = `
.brt-editor {
  border: 1px solid var(--bui-border-1);
  border-radius: 4px;
  background: var(--bui-bg-neutral-1);
}
.brt-editor .brt-content {
  outline: none;
  min-height: 4.5em;
  padding: 8px;
}
.brt-content { font-size: 0.875rem; line-height: 1.5; }
.brt-placeholder {
  position: absolute;
  top: 8px;
  left: 8px;
  pointer-events: none;
  color: var(--bui-fg-secondary);
}
.brt-content .brt-p { margin: 0 0 0.5em; }
.brt-content .brt-p:last-child { margin-bottom: 0; }
.brt-h { font-weight: 700; margin: 0.4em 0 0.3em; }
.brt-h1 { font-size: 1.25rem; }
.brt-h2 { font-size: 1.125rem; }
.brt-h3 { font-size: 1rem; }
.brt-h4 { font-size: 0.875rem; }
.brt-h5 { font-size: 0.8125rem; }
.brt-h6 { font-size: 0.75rem; }
.brt-ul, .brt-ol { margin: 0 0 0.5em; padding-left: 1.5em; }
.brt-code, .brt-codeblock {
  font-family: monospace;
  background: var(--bui-bg-neutral-2);
  border-radius: 4px;
}
.brt-codeblock {
  display: block;
  margin: 0 0 0.5em;
  padding: 8px;
  overflow-x: auto;
  white-space: pre;
}
.brt-table {
  border-collapse: collapse;
  margin: 0 0 0.5em;
  display: block;
  overflow-x: auto;
}
.brt-td, .brt-th {
  border: 1px solid var(--bui-border-1);
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
}
.brt-th { background: var(--bui-bg-neutral-2); font-weight: 700; }
.brt-td > p, .brt-th > p { margin: 0; }
.brt-hashtag {
  color: var(--bui-fg-link);
  background: var(--bui-bg-neutral-2);
  border-radius: 4px;
}
.brt-mention {
  color: var(--bui-fg-link);
  background: var(--bui-bg-neutral-2);
  border-radius: 4px;
}
.brt-mention a { color: inherit; }
.brt-link { color: var(--bui-fg-link); }
.brt-mention-menu {
  list-style: none;
  margin: 4px 0 0;
  padding: 4px;
  min-width: 220px;
  max-width: 420px;
  background: var(--bui-bg-neutral-1);
  border: 1px solid var(--bui-border-1);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  position: relative;
}
.brt-mention-option {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brt-mention-option-selected { background: var(--bui-bg-neutral-2); }
`;

/**
 * Imports stored markdown into the current editor. Also the safety pass:
 * pipe lines without a divider row stay paragraphs, and only http(s)
 * links survive as links (matching the previous renderer's rules).
 */
export function $importMarkdown(markdown: string): void {
  $convertFromMarkdownString(markdown, BOARDS_TRANSFORMERS);
  $normalizeImportedTables();
  for (const link of $nodesOfType(LinkNode)) {
    if (/^https?:\/\//.test(link.getURL())) {
      link.setTarget('_blank');
      link.setRel('noopener noreferrer');
    } else {
      for (const child of link.getChildren()) {
        link.insertBefore(child);
      }
      link.remove();
    }
  }
}

/** Serializes the current editor content back to markdown. */
export function $exportMarkdown(): string {
  return $convertToMarkdownString(BOARDS_TRANSFORMERS);
}

function onError(error: Error) {
  // eslint-disable-next-line no-console
  console.error(error);
}

function composerConfig(markdown: string, editable: boolean) {
  return {
    namespace: 'boards-richtext',
    nodes: RICH_TEXT_NODES,
    theme: THEME,
    editable,
    onError,
    editorState: () => $importMarkdown(markdown),
  };
}

/**
 * Read-only rendering of the markdown subset — the same Lexical setup
 * as {@link RichTextEditor} with editing disabled, so view and edit
 * modes cannot drift apart.
 */
export function RichTextViewer(props: { markdown: string }) {
  return (
    <LexicalComposer
      // content is immutable in this mode; remount on new content
      key={props.markdown}
      initialConfig={composerConfig(props.markdown, false)}
    >
      <style>{STYLES}</style>
      <RichTextPlugin
        contentEditable={<ContentEditable className="brt-content" />}
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  );
}

/**
 * The markdown-backed rich text editor for comments and the item
 * description: WYSIWYG markdown shortcuts, `#tag` highlighting, and
 * `@` entity mentions with catalog autocompletion. `onChange` reports
 * the content serialized back to markdown.
 */
function EditorRefPlugin(props: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();
  const { onReady } = props;
  useEffect(() => onReady(editor), [editor, onReady]);
  return null;
}

export function RichTextEditor(props: {
  ariaLabel: string;
  initialMarkdown?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (markdown: string) => void;
  /** Hands out the Lexical editor, for programmatic edits in tests. */
  onEditorReady?: (editor: LexicalEditor) => void;
}) {
  const { onChange } = props;
  const handleChange = useCallback(
    (editorState: EditorState, _editor: LexicalEditor) => {
      onChange(editorState.read($exportMarkdown));
    },
    [onChange],
  );

  return (
    <LexicalComposer
      initialConfig={composerConfig(props.initialMarkdown ?? '', true)}
    >
      <style>{STYLES}</style>
      <div className="brt-editor" style={{ position: 'relative' }}>
        <RichTextPlugin
          contentEditable={
            props.placeholder ? (
              <ContentEditable
                className="brt-content"
                aria-label={props.ariaLabel}
                aria-placeholder={props.placeholder}
                placeholder={
                  <div className="brt-placeholder">{props.placeholder}</div>
                }
              />
            ) : (
              <ContentEditable
                className="brt-content"
                aria-label={props.ariaLabel}
              />
            )
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <TablePlugin />
      <HashtagPlugin />
      <MentionsPlugin />
      <MarkdownShortcutPlugin transformers={BOARDS_TRANSFORMERS} />
      <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      {props.autoFocus && <AutoFocusPlugin />}
      {props.onEditorReady && <EditorRefPlugin onReady={props.onEditorReady} />}
    </LexicalComposer>
  );
}

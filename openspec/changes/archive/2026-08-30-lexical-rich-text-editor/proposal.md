# Lexical Rich Text Editor for Descriptions and Comments

## Why

Comments and item descriptions are edited as raw markdown in a plain textarea and rendered by a hand-rolled parser (`plugins/boards/src/components/markdown.ts`). That parser has grown feature by feature (bold, lists, headings, tables, mentions) and is nearing the limit of what a regex tokenizer maintains well, while the editing experience shows none of it — no formatting feedback, no help finding an entity to mention. Replacing both sides with [Lexical](https://lexical.dev) gives WYSIWYG editing, live highlighting, and mention autocomplete from one maintained engine.

## What Changes

- Replace the textarea-based editing of the item description and of comments (new and edited) with a Lexical rich text editor.
- The editor supports the markdown elements the plugin renders today and edits them visually: bold, italics, headings, lists, links, inline code, code blocks (code snippets), and tables — with the usual markdown shortcut syntax (`**`, `#`, `|`…) converting as you type.
- `#tags` are highlighted in the editor and in rendered content.
- `@`-entity references (any catalog kind, shorthand or full ref) are highlighted and rendered as catalog links, as today.
- Typing `@` opens an entity search autocompletion backed by the catalog; picking an entry inserts the mention.
- Yes — the same library also serves the read-only mode: the read-only rendering of descriptions, comments, and their version history uses the same Lexical setup with editing disabled, replacing `MarkdownContent`, so edit and view modes cannot drift apart. The custom parser (`markdown.ts`) is removed.
- Storage format is unchanged: content is still persisted, versioned, and drafted as markdown text. The editor imports markdown on open and exports markdown on save, so old content, the backend's mention-notification extraction, and the user-settings drafts all keep working. No API or schema change.

## Capabilities

### New Capabilities

None — this changes how existing comment/description behavior is delivered and adds editor behavior to the existing capability.

### Modified Capabilities

- `boards/comments-and-history`: adds a rich-text-editing requirement — WYSIWYG editing with markdown shortcuts, `@` entity autocompletion, hashtag highlighting, and read-only rendering through the same editor engine, with markdown remaining the storage format.

## Impact

- New frontend dependencies: `lexical`, `@lexical/react`, and the official companion packages (`markdown`, `rich-text`, `list`, `code`, `link`, `table`, `hashtag`, `utils`), pinned to one version.
- `plugins/boards/src/components/`: new shared rich-text component (editor + read-only viewer); `EditableMarkdown.tsx` and the `ItemDrawer.tsx` comment composer switch to it; `MarkdownContent` in `common.tsx` and the whole `markdown.ts` parser (plus their tests) are removed; mention/hashtag/table markdown round-trip lives in custom Lexical nodes/transformers.
- `plugins/boards-common/src/mentions.ts` is unchanged and stays the single source of mention syntax for the backend; the mention Lexical node reuses it.
- Backend: no changes (markdown in, markdown out).
- Tests: new component tests for the editor/viewer and markdown round-trip; e2e screenshots that show the composer or rendered content need regenerated baselines.

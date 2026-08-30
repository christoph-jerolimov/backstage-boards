# Design: Lexical Rich Text Editor

## Context

See proposal.md for motivation. Current state:

- Content (comments, description, their versions, drafts) is stored and transported as **markdown strings**; the backend's mention notifications parse that markdown via `extractMentions` (`plugins/boards-common/src/mentions.ts`).
- Editing: `EditableMarkdown.tsx` (description + comment edits) and the `ItemDrawer.tsx` comment composer, both plain `TextAreaField`s over the raw markdown.
- Rendering: `MarkdownContent` in `common.tsx` over the hand-rolled tokenizer `markdown.ts` (bold, italics, code, code blocks, links, lists, headings, pipe tables, bare-entity-ref auto-linking, @-mentions).
- `CatalogRefPicker.tsx` already implements catalog-backed autocomplete (fetch all entities with a small field set, cache 5 min, filter client-side).
- Constraint: raw HTML must never render; the storage format must remain markdown (backend, versions, and drafts depend on it).

## Goals / Non-Goals

**Goals:**
- One shared Lexical setup (nodes, theme, transformers) powering an editable editor and a read-only viewer, replacing both the textareas and `MarkdownContent`/`markdown.ts`.
- Lossless markdown round-trip for the supported element set; unknown markdown degrades to plain text but is never dropped.
- Mention syntax authority stays in `boards-common` so frontend and backend cannot drift.

**Non-Goals:**
- Storing Lexical's JSON editor state (no schema change; markdown remains canonical).
- A formatting toolbar — markdown shortcuts and autocompletion only, matching the current minimal UI (can be added later).
- Collaborative editing, images/attachments, lazy-loading the editor bundle.
- Changing the checklist, timeline, or draft-persistence mechanics.

## Decisions

### D1: Markdown stays the storage format; Lexical converts at the boundary
On open, markdown is imported with `$convertFromMarkdownString`; on save/draft, exported with `$convertToMarkdownString` — both with our transformer set. Alternative (persisting Lexical JSON) rejected: it would require schema/API changes, break `extractMentions` on the backend, make version history unreadable, and strand existing content. Drafts keep flowing through the existing `useDraft` string mechanism: the editor's change listener exports markdown (debounced) into `onDraftChange`.

### D2: One `RichText` module with two entry points
`RichTextEditor` (editable) and `RichTextViewer` (same `LexicalComposer` config with `editable={false}`, state initialized from the markdown prop). This is the answer to "can the library also be used for read-only mode": yes, Lexical renders read-only natively, and sharing the config guarantees view and edit parity. `RichTextViewer` replaces every `MarkdownContent` usage (drawer description, comments, version history); `markdown.ts` and `MarkdownContent` are deleted with their tests.

### D3: Official Lexical packages, pinned to one version (0.49.x)
`lexical`, `@lexical/react`, `@lexical/markdown` (shortcut + import/export transformers), `@lexical/rich-text` (headings), `@lexical/list`, `@lexical/code` (code blocks), `@lexical/link`, `@lexical/table`, `@lexical/hashtag`, `@lexical/utils`. All `@lexical/*` versions must match exactly — mixed versions break node registration.

### D4: MentionNode as an inline DecoratorNode built on boards-common
A custom `MentionNode` carries the resolved entity ref and renders `EntityRefLink` (read-only: clickable; editing: an atomic highlighted token that deletes as one unit). A `TextMatchTransformer` uses `findMentions`/`resolveMentionRef` from `@internal/plugin-boards-common` for import and exports the mention back as the literal `@…` text it came from, so the backend's `extractMentions` sees exactly what it sees today. Bare entity refs without `@` (e.g. `system:default/example`) keep their auto-linking through a second text-match transformer reusing the existing ref pattern; `text:` refs stay plain. Alternative (TextNode-styled mention like the Lexical playground) rejected: it cannot render a catalog link in read-only mode.

### D5: Hashtags via `@lexical/hashtag`, highlight-only
`HashtagPlugin` highlights `#tag` tokens live; the theme colors them via `--bui` tokens. Hashtags export as the plain `#tag` text (no markdown syntax involved). Ambiguity with headings is resolved by the existing rules: headings need `# ` (hash + space) at line start; hashtags need a non-space word directly after `#`.

### D6: Tables via `@lexical/table` plus a ported markdown table transformer
`@lexical/markdown` ships no table transformer; port the one from the Lexical playground (GitHub-style pipe rows + `| --- |` separator) onto `TableNode`/`TableRowNode`/`TableCellNode`. Same accepted syntax as the current parser, so existing stored tables import cleanly.

### D7: `@`-autocomplete via `LexicalTypeaheadMenuPlugin` over the shared catalog query
The typeahead triggers on `@`, queries the same data as `CatalogRefPicker` — extract its `getEntities` + 5-minute-cache + client-side-filter logic into a shared `useCatalogOptions` hook both use — and inserts a `MentionNode` on selection. Keyboard: arrows + Enter select, Escape dismisses, and typing a full ref manually still works without the menu.

### D8: Theme and safety
A Lexical theme maps node classes onto the same drawer-scale styles as the current renderer (headings `title-medium`→`body-x-small`, bordered table cells with `--bui-border-1`/`--bui-bg-neutral-2`, `overflow-x: auto` around tables). Lexical escapes all content as text — no HTML pass-through — preserving the "raw HTML never renders" guarantee; markdown import treats HTML as literal text exactly like today.

## Risks / Trade-offs

- [Round-trip loses or mangles content the user had (worst case: silent data loss on an untouched save)] → import unknown markdown as plain text (never dropped), keep `EditableMarkdown`'s existing "skip save when text is unchanged" check comparing exported markdown against the stored text, and add round-trip unit tests over every supported element plus a mixed document.
- [Bundle size: Lexical adds ~100KB min+gz to the plugin] → accepted for v1 (single import path makes later `React.lazy` splitting easy); noted as a non-goal.
- [`@lexical/hashtag`'s token rules differ slightly from free-text tags users typed historically] → highlight-only feature; a tag that fails to highlight still renders as its plain text, nothing breaks.
- [e2e screenshot baselines show the old composer/renderer] → regenerate affected baselines (light + dark) with the repo's `yarn test:e2e --update-snapshots` flow on Linux, as `playwright.config.ts` prescribes.
- [Version-pinning drift among `@lexical/*` packages] → single shared version constant in `package.json`; CI's dedupe/type checks catch mismatches.

## Migration Plan

Frontend-only swap behind unchanged APIs: deploy renders existing markdown through the new viewer immediately; nothing stored changes shape. Rollback = revert the commit (content saved in the interim is still plain markdown and renders fine with the old code).

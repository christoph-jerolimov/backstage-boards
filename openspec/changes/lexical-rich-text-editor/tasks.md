# Tasks: Lexical Rich Text Editor

## 1. Foundation: shared Lexical setup and markdown round-trip

- [x] 1.1 Add `lexical`, `@lexical/react`, `@lexical/markdown`, `@lexical/rich-text`, `@lexical/list`, `@lexical/code`, `@lexical/link`, `@lexical/table`, `@lexical/hashtag`, and `@lexical/utils` to `plugins/boards/package.json`, all pinned to the same version. Verify `yarn install` and `yarn tsc` succeed.
- [x] 1.2 Create the shared `RichText` module (`plugins/boards/src/components/richtext/`): node list, `--bui`-token theme at drawer scale (design D8), transformer set, and the `RichTextEditor` / `RichTextViewer` pair sharing one config with `editable` toggled (design D2). Verify with a component test rendering the viewer for markdown with bold, a heading, a list, and a code block.
- [x] 1.3 Implement markdown import/export at the boundary (design D1): viewer initializes from a markdown prop; editor exposes `onChange(markdown)` and an imperative/save path returning markdown. Verify with round-trip unit tests: each supported element and one mixed document export back to equivalent markdown, and unknown markdown (e.g. a blockquote) survives as plain text.

## 2. Mentions, bare refs, and hashtags

- [x] 2.1 Implement `MentionNode` (inline decorator, design D4) rendering `EntityRefLink`, plus its `TextMatchTransformer` built on `findMentions`/`resolveMentionRef` from `@internal/plugin-boards-common`; export reproduces the literal `@…` text. Verify with tests: `@component:webserver-example` and `@jane` import as mentions linking the right refs and export unchanged; `@text:foo` stays plain.
- [x] 2.2 Add bare-entity-ref auto-linking (design D4) for refs like `system:default/example` (excluding `text:`/`http`/`https`/`mailto`), rendering as catalog links in the viewer. Verify with a viewer test asserting the link href and that `text:anonymous` stays plain.
- [x] 2.3 Register `HashtagNode`/`HashtagPlugin` with themed highlighting (design D5). Verify with a test that `#frontend` gets the hashtag class in editor and viewer and exports as plain `#frontend`.

## 3. Tables and code blocks

- [x] 3.1 Port the pipe-table markdown transformer onto `@lexical/table` nodes (design D6), with the viewer wrapping tables in an `overflow-x: auto` container and themed header cells. Verify with tests: the existing stored-table syntax (`| a | b |` + `| --- | --- |` + rows) imports to a table and exports back; a pipe line without a separator row stays a paragraph.
- [x] 3.2 Wire code blocks (` ``` ` fences) through `@lexical/code` with the markdown CODE transformer. Verify with a round-trip test that fenced content is preserved verbatim and renders in a `<code>` block without entity linking inside.

## 4. Entity autocompletion

- [x] 4.1 Extract `CatalogRefPicker`'s catalog query (fields, 5-minute cache, client-side filter) into a shared `useCatalogOptions` hook and re-use it in `CatalogRefPicker`. Verify existing `CatalogRefPicker`/`EntityPicker` tests still pass.
- [x] 4.2 Add the `@`-typeahead plugin (design D7) using `LexicalTypeaheadMenuPlugin` + `useCatalogOptions`: typing `@` opens catalog suggestions; arrows/Enter insert a `MentionNode`; Escape dismisses; a manually typed full ref still becomes a mention. Verify with component tests using a mocked catalog API.

## 5. Integration into the drawer

- [x] 5.1 Switch `EditableMarkdown.tsx` to `RichTextEditor` for editing and `RichTextViewer` for display and version history, keeping the save semantics (trim, unchanged-text skip, `allowEmpty`) and the markdown-string draft flow (design D1). Verify `EditableMarkdown` tests cover save, cancel, draft restore, and unchanged-save skip with the new editor.
- [x] 5.2 Switch the `ItemDrawer.tsx` comment composer to `RichTextEditor`, clearing the editor after submit and keeping the comment draft behavior. Verify with the drawer/timeline component tests.
- [x] 5.3 Remove `markdown.ts`, `markdown.test.ts`, and `MarkdownContent` (migrating still-relevant rendering assertions into `RichTextViewer` tests), and update `common.test.tsx`. Verify no remaining references via grep and a clean `yarn tsc`.

## 6. Verification

- [x] 6.1 Run the full checks — `yarn tsc`, `yarn lint:all`, `yarn prettier --check`, and the boards/boards-common/boards-backend test suites — and verify everything passes.
- [x] 6.2 Sanity-check in the running app: edit a description and a comment with headings, a table, a code block, `#tag`, and an `@` autocompleted mention; confirm WYSIWYG shortcuts, the typeahead, saved markdown re-rendering identically, and mention links pointing at catalog pages.
- [ ] 6.3 Regenerate the affected e2e screenshot baselines (light + dark) via `yarn test:e2e --update-snapshots` and verify the full e2e suite passes against them.

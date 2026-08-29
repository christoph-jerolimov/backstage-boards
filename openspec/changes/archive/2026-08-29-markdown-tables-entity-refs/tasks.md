# Tasks: Markdown Headings/Tables and Full Entity-Ref Mentions

## 1. Mentions: any-kind entity refs (boards-common)

- [x] 1.1 Widen `MENTION_PATTERN` in `plugins/boards-common/src/mentions.ts` to accept any kind (`@<kind>:<name>`, `@<kind>:<namespace>/<name>`), excluding the non-entity kinds (`text`, `http`, `https`, `mailto`); keep the `@name` shorthand resolving to `user:default/<name>`. Verify with new `mentions.test.ts` cases for `@component:webserver-example` → `component:default/webserver-example` and `@group:default/another-team`.
- [x] 1.2 Add a user/group kind filter to `extractMentions` so it keeps returning only principal refs; `findMentions` returns all kinds. Verify with a `mentions.test.ts` case that `extractMentions('@component:webserver-example @carol')` returns only `user:default/carol` while `findMentions` reports both.

## 2. Mentions: rendering and notifications

- [x] 2.1 Verify mention rendering of non-principal refs end to end: add a `common.test.tsx` (or `markdown.test.ts`) case that `@component:webserver-example` in a comment renders as an entity link to `component:default/webserver-example`, and `@text:foo` stays plain text.
- [x] 2.2 Pin notification behavior in the backend: add a `BoardsService` test that saving a comment containing only `@component:...` sends no mention notification, and one mixing `@component:...` with `@user:...` notifies only the user. Verify with `yarn workspace @internal/plugin-boards-backend test` (or repo test filter) passing.

## 3. Markdown parser: headings and tables

- [x] 3.1 Add the `heading` block token (`level` 1–6, inline children) to `parseMarkdown` in `plugins/boards/src/components/markdown.ts`, matched by `#{1,6}` + space at line start and excluded from paragraph accumulation. Verify with `markdown.test.ts` cases: `## Title` parses as level-2 heading with inline formatting, `#hashtag` stays a paragraph.
- [x] 3.2 Add the `table` block token (header cells, body rows of inline-token cells) per design D3: pipe line + separator-row lookahead starts a table, boundary pipes stripped, cells trimmed and inline-parsed, ragged rows normalized to header width. Verify with `markdown.test.ts` cases: a 2-column table with bold text and an entity ref in cells; a pipe line without a separator row stays a paragraph; paragraph directly above a table is not swallowed (design D4).

## 4. Markdown renderer

- [x] 4.1 Render `heading` tokens in `MarkdownContent` (`plugins/boards/src/components/common.tsx`) as `h1`–`h6` elements with drawer-scale heading styles that decrease monotonically with level. Verify with a `common.test.tsx` case asserting the heading element/role and its inline children render.
- [x] 4.2 Render `table` tokens as a `<table>` with a visually distinct header row inside an `overflow-x: auto` wrapper, cells rendered through `InlineTokens`. Verify with a `common.test.tsx` case asserting header/body cells, and an entity link inside a cell.

## 5. Integration and spec sync

- [x] 5.1 Run the full plugin checks — `yarn tsc`, `yarn lint`, and the boards/boards-common/boards-backend test suites — and verify everything passes.
- [x] 5.2 Sanity-check rendering in the running app (item description or comment with a heading, a table containing `@component:webserver-example`, and a `@group:default/another-team` mention) and verify links point at the catalog pages; update e2e screenshots if `e2e-tests/screenshots.test.ts` is affected.

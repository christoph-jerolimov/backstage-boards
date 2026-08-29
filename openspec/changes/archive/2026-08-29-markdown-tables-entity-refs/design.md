# Design: Markdown Headings/Tables and Full Entity-Ref Mentions

## Context

See proposal.md for motivation. Current state:

- `plugins/boards/src/components/markdown.ts` is a hand-rolled, safe markdown-subset tokenizer: `parseMarkdown` produces `BlockToken`s (`paragraph`, `codeBlock`, `list`), `parseInline` produces `InlineToken`s, and `autolinkEntities` merges @-mentions (via `findMentions`) with bare entity-ref auto-linking. Raw HTML is never emitted.
- `plugins/boards/src/components/common.tsx` (`MarkdownContent`, `InlineTokens`) renders these tokens as React elements from `@backstage/ui` primitives; entity tokens render as `EntityRefLink`.
- `plugins/boards-common/src/mentions.ts` owns `MENTION_PATTERN` (currently `user|group` only), `resolveMentionRef`, `extractMentions` (backend notifications) and `findMentions` (frontend rendering).
- `plugins/boards-backend/src/service/BoardsService.ts` calls `extractMentions` to decide who gets a mention notification.

Constraint: keep the "small, safe subset" property — no third-party markdown library, no raw HTML pass-through.

## Goals / Non-Goals

**Goals:**
- ATX headings (`#`–`######`) and GitHub pipe tables as new block tokens, with full inline formatting/auto-linking inside heading text and table cells.
- Mentions match any catalog kind while notification extraction stays scoped to user/group.
- One shared mention pattern so frontend rendering and backend notification scanning cannot drift.

**Non-Goals:**
- Table column alignment (`:---:` colons are tolerated in the separator row but ignored), row/column spans, multi-line cells, escaped pipes inside cells.
- Setext headings (`===`/`---` underlines), nested lists, blockquotes.
- Mention autocomplete UI, existence validation of mentioned entities.

## Decisions

### D1: Widen `MENTION_PATTERN` to any kind; filter principals in `extractMentions`
The ref alternative in `MENTION_PATTERN` changes from `(?:user|group):` to a generic kind `[a-zA-Z][a-zA-Z0-9]*:`; the `@name` shorthand branch is unchanged. `findMentions` returns every match (rendering links all kinds); `extractMentions` gains a kind filter and keeps returning only `user:`/`group:` refs, so `BoardsService` needs no change and can never accidentally notify a component. Alternative — filtering in the backend caller — rejected: every future caller of `extractMentions` would have to remember the filter, and the function's contract ("principals mentioned") already implies it. `@text:...` is excluded from matching (shared non-entity kind set with the bare-ref auto-linker), mirroring the existing `text:` rule.

### D2: `heading` block token, parsed before lists/paragraphs
`{ type: 'heading'; level: 1–6; children: InlineToken[] }`, matched by `/^#{1,6}\s+/` on a single line. Renderer maps levels to heading elements with drawer-appropriate sizing (a `# h1` in a comment must not dwarf the page chrome): levels render as `h1`–`h6` elements but styled via the design system's smaller heading variants, monotonically decreasing. A `#` without a following space stays paragraph text (so `#hashtag` is unaffected).

### D3: `table` block token requiring a separator row
`{ type: 'table'; header: InlineToken[][]; rows: InlineToken[][][] }`. A table starts only where a pipe-containing line is immediately followed by a valid separator row (`^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$`); otherwise pipe lines remain paragraph text — this is the cheap, unambiguous GFM signal and avoids false positives on prose containing `|`. Rows are consumed while lines contain `|`. Cells split on `|` with boundary pipes stripped and cells trimmed; each cell runs through `parseInline`, so bold/code/links/mentions work in cells. Ragged rows are padded/truncated to the header width. Rendered as a real `<table>` inside an `overflow-x: auto` wrapper (same guard the code block uses).

### D4: Paragraph accumulation stops at heading/table starts
The paragraph loop in `parseMarkdown` currently breaks on blank lines, fences, and list markers; it additionally breaks on heading lines and table starts (pipe line + separator lookahead), so a heading or table directly under a paragraph is not swallowed into it.

## Risks / Trade-offs

- [Widened pattern matches unintended text like `@http:...` or scoped npm packages `@scope/pkg`] → the generic-kind branch requires a `:` (so `@scope/pkg` still only matches shorthand `@scope` — same behavior as today), and the shared non-entity kind set excludes `text`/`http`/`https`/`mailto`.
- [Existing comments containing pipe-art or `#` lines change appearance] → tables require the separator row and headings require `# ` with a space, so only text that already looks like intentional markdown changes rendering; accepted.
- [Notification regression if a caller uses `findMentions` for notifications] → `extractMentions` remains the only notification entry point; backend tests add a non-principal-mention case to pin this.

## Migration Plan

Pure frontend/shared-lib change, no schema or API migration. Old content re-renders with the new parser on next view; nothing stored changes. Rollback = revert the commit.

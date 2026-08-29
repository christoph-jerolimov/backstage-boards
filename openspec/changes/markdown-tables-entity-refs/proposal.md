# Markdown Headings/Tables and Full Entity-Ref Mentions

## Why

Comments and item descriptions render a deliberately small markdown subset, but longer descriptions have no way to structure content: headings (`# ...`) and tables (`| ... |`) show up as plain paragraph text, which reads badly for anything beyond a short note. Separately, @-mentions only accept `user:` and `group:` refs (or the `@name` shorthand), so referencing any other catalog entity — e.g. `@component:webserver-example` — is silently not linked even though the catalog knows the entity.

## What Changes

- Extend the markdown subset parser/renderer to support ATX headings (`#` through `######`) rendered as styled heading elements.
- Extend the markdown subset parser/renderer to support GitHub-style pipe tables (header row, `|---|` separator row, body rows) with inline formatting and entity auto-linking inside cells; still no raw HTML.
- Extend @-mention syntax to accept full entity refs of any kind (`@<kind>:<name>` and `@<kind>:<namespace>/<name>`), e.g. `@component:webserver-example` or `@group:default/another-team`; mentions render as catalog entity links like today.
- Mention notifications stay limited to user/group principals: mentioning a non-principal entity (e.g. a component) links it but notifies nobody.
- The `@name` shorthand keeps resolving to `user:default/<name>` — no behavior change for existing content.

## Capabilities

### New Capabilities

None — both areas extend existing capabilities.

### Modified Capabilities

- `boards/comments-and-history`: the rendered markdown subset gains headings and tables; mention rendering accepts full entity refs of any kind, not only user/group.
- `boards/watching-and-notifications`: mention notifications are explicitly scoped to user/group mentions now that the mention syntax also matches other entity kinds.

## Impact

- `plugins/boards-common/src/mentions.ts`: `MENTION_PATTERN`/`resolveMentionRef` widen to any kind; `extractMentions` (used by the backend for notifications) must keep returning only user/group principals, so the kind filter moves into or in front of it.
- `plugins/boards/src/components/markdown.ts`: new `heading` and `table` block tokens in `parseMarkdown`.
- `plugins/boards/src/components/common.tsx`: `MarkdownContent` renders the new block tokens (heading levels, table markup with horizontal-scroll safety).
- `plugins/boards-backend/src/service/BoardsService.ts`: mention-notification path unchanged in behavior, but depends on the common package's filtering; verify with tests.
- Tests: `markdown.test.ts`, `mentions.test.ts`, `common.test.tsx`, and backend notification tests get new cases.
- No API, schema, or dependency changes; purely parser/renderer plus the shared mentions module.

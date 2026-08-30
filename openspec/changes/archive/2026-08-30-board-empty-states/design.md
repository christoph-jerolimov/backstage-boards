## Context

The app runs on the new frontend system with `@backstage/ui` (no
`core-components` `EmptyState`), so the block is built from `ui`
primitives in the Backstage visual style. `BoardsClient` throws plain
`Error`s with the payload message, so callers cannot tell a 404 from
anything else; react-query retries every failure once (`retry: 1`).

## Goals / Non-Goals

**Goals:**
- One shared empty-state block, adopted by the board page's error
  states, the reader's empty board, and the board list's empty tabs.
- 404-aware error handling in the client.

**Non-Goals:**
- No app-wide 404 route; only the board page's own states.
- No redesign of loading states or of the my-items page.

## Decisions

- **`BoardsRequestError extends Error`** carrying `status`, thrown by
  `BoardsClient.fetch`; the shared query-client retry predicate skips
  retries for status 404 and keeps one retry otherwise.
- **`EmptyState` component** (`icon?, title, description?, actions?`)
  centered with generous padding, icon in a muted circle, using
  remixicon icons like the rest of the plugin.
- **Embedded board pages** (entity tab) show the same not-found state;
  the "Back to boards" action links to the boards root path in both
  cases.
- Board list keeps its exact wording; only the presentation moves into
  the shared block.

## Risks / Trade-offs

- The backend intentionally 404s boards the caller may not read, so the
  not-found page covers "no access" too; the hint text mentions both.

## Why

A mistyped or stale board link currently yields a bare one-line error
("Board could not be loaded: 404 Not Found"), and several empty
situations render as plain secondary text or a blank area. A proper
Backstage-style not-found page and consistent empty states make dead
ends recoverable and first-run screens friendly.

## What Changes

- A shared **empty-state block** (icon, title, description, optional
  actions) in the Backstage visual style, built on `@backstage/ui`.
- The board page distinguishes **not found** (HTTP 404) from other load
  errors: not-found shows "Board not found" with why it might be and a
  "Back to boards" action; other errors show the message with a Retry
  action. The client's errors now carry the HTTP status, and a 404 is
  not retried.
- A **reader's empty board** (no columns) shows an explanatory empty
  state instead of a blank area; writers keep the add-column
  affordance.
- The board list's empty tabs render the shared empty-state block
  (star-a-board hint, no-boards-yet hint, no-match-with-filters), same
  wording as today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/board-management`: new "Not-found page and empty states"
  requirement.

## Impact

- `plugins/boards/src/api.ts` — typed request error with HTTP status.
- New `EmptyState` component; `BoardPage`, `BoardView`,
  `BoardListPage` adopt it; query retry skips 404s.
- Docs: no user-facing feature docs beyond a README line.

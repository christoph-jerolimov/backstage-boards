# Implementation notes and verification results

Implemented 2026-08-27. All 29 tasks complete.

## What was built

- `plugins/boards-common` — shared types, `text:` ref helpers, permission level utilities.
- `plugins/boards-backend` — Knex migrations (12 tables, cascade FKs, verified on SQLite),
  `BoardAccessResolver`, `BoardsService`, Express router under `/api/boards`,
  notification fan-out via `@backstage/plugin-notifications-node`, and 14 actions
  registered through `actionsRegistryServiceRef`.
- `plugins/boards` — NFS-only frontend (`createFrontendPlugin`): board list page
  (Favorites/All), kanban view with react-aria drag & drop plus a menu-based
  accessible "Move to column" fallback, table view, group-by-assignee in both
  views, item detail drawer with unified comments+changes timeline, share
  dialog, entity "Boards" tab (`EntityContentBlueprint`).

## Automated verification

- `yarn tsc` and `yarn tsc:full` pass (exit 0).
- `yarn lint:all` passes.
- `yarn test`: 81 tests, 8 suites, all green — includes access-resolver
  scenario tests mirroring the board-sharing spec, service tests for change
  records/comment versions/external items/notification dedup, supertest router
  tests (private hidden as 404, read-only mutation 403, anonymous public
  read/write, last-admin 409), actions parity tests, and frontend
  markdown/autolink + grouping tests.

## Live end-to-end verification (backend + app dev servers, Playwright)

Identities exercised: guest user (`user:development/guest`), anonymous
(no credentials), and a service principal (unit level). Guest auth only
provides a single logged-in identity in this dev setup, so "second user"
flows (group grants, cross-user permission checks) are covered by the router
unit tests with two mock users instead.

- Create board via UI and API → appears in list; favorite toggle persists.
- Kanban renders all columns with counts; item drawer opens via `?item=` deep
  link and shows the unified timeline (created / moved / edited comment).
- Comment edit kept prior version (`versionCount: 2`, versions endpoint
  returns both texts).
- `public-read`: anonymous GET returns the board read-only; anonymous POST
  rejected 403. `private`: anonymous GET is 404. `public-write`: anonymous
  edit accepted and recorded as `text:anonymous`.
- Watch + notification: guest watched an item, an anonymous edit produced
  exactly one notification in the notifications plugin
  ("Item updated | …title changed | /boards/<id>?item=<id>"); no
  self-notifications on own changes (unit-verified as well).
- Actions registry: all 14 `boards:*` actions listed at
  `/api/boards/.backstage/actions/v1/actions`; invoking `boards:add-item`
  created an item; invoking it with `externalManager` as a user was rejected
  (`NotAllowedError`), matching the REST path. External items created by a
  service principal are read-only for users (unit + router verified) and the
  UI hides edit controls and shows a "Managed by X (read-only)" indicator.
- Group-by-assignee: two-assignee item appears in both swimlanes and in both
  table groups; unassigned items in an "Unassigned" group.
- Entity tab: board assigned to `component:default/example-website` shows up
  on that entity's "Boards" tab.
- Screenshots captured during verification (board list, kanban, drawer,
  table, swimlanes, share dialog, entity tab) — session scratch only, not
  committed.

## Deviations from the design worth noting

- `uuid` package replaced with node's `crypto.randomUUID` (no extra dep).
- Actions invoke endpoint takes the flat input object as the request body.
- The drag gesture itself was not exercised headlessly; moves were verified
  through the status select, the move menu, and the API. The DnD code uses
  react-aria `useDrag`/`useDrop` with the keyboard-accessible menu fallback
  required by the design.

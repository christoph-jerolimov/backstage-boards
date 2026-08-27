# Unit Test Coverage for Common Refs and Frontend Components

## Why

Coverage is uneven: `boards-backend` sits at 82% statements, but
`boards-common` leaves `refs.ts` (0%) without direct tests, and the
frontend plugin is at 14.6% — every React component is untested by
Jest, verified only through Playwright smoke runs. Component behaviour
that regressed before (focus handling, menu contents, colors) has no
fast test to catch it.

## What Changes

- `boards-common`: direct unit tests for `refs.ts` — text-ref helpers,
  actor/principal/entity ref validation, and the permission level
  helpers.
- `plugins/boards`: a jest-dom setup file and component tests using
  React Testing Library for the presentational and interactive
  components: `DueDateBadge`/`formatDueDate`, `GroupLabel`,
  `StatusBadge`/`ColumnDot`, `TagsEditor`, `ItemMenu`, and
  `AssigneeAvatars`, plus the `common.tsx` helpers (`RefDisplay`,
  `InlineEdit`, `changeSummary`, `formatDate`) and `BoardsClient`
  (`api.ts`) against a mocked fetch.

## Impact

- New test files only; no production behaviour changes.
- `plugins/boards`: `src/setupTests.ts` registering jest-dom matchers,
  `@testing-library/user-event` added as a dev dependency.

# Reminder Notifications

## Why

Due dates only help when people see them. Admins need a way to remind
users about their assigned items on a schedule — different user groups at
different times, with control over which items count (everything vs. only
overdue) and how the messages are bundled.

## What Changes

- New backend configuration `boards.reminders`: an array of reminder
  definitions, each with:
  - `id` and a schedule (`cron` expression or `frequencyHours`);
  - a catalog user filter (`userFilter`, catalog filter fields merged
    with `kind: User`) plus an `excludeUsers` matcher (entity field →
    value, e.g. skip users labeled `boards/notifications: false`);
  - a `scope` deciding which of the user's items count: `all`,
    `with-due-date`, `due-today`, or `overdue`;
  - a `grouping`: `combined` (one message per user across all boards) or
    `per-board` (one message per user per board).
- On each run, the reminder resolves matching users from the catalog,
  computes each user's assigned items (direct or via their `memberOf`
  groups, honoring board access and archival exactly like the My-items
  view), applies the scope, and sends individual notifications through
  the notification system.
- A config schema (`config.d.ts`) documents the options.

## Impact

- `boards-backend`: new `reminders.ts` (config parsing, scheduling, run
  logic), plugin wiring (`rootConfig`, catalog service), config schema,
  new dependency `@backstage/plugin-catalog-node`.
- No frontend or API changes.

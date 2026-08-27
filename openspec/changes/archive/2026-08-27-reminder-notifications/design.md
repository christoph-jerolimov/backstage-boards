# Design

## Configuration

```yaml
boards:
  reminders:
    - id: overdue-weekday-mornings
      cron: '0 8 * * 1-5'          # either cron ...
      # frequencyHours: 24         # ... or a fixed frequency
      scope: overdue               # all | with-due-date | due-today | overdue
      grouping: per-board          # combined (default) | per-board
      userFilter:                  # optional catalog filter, merged with kind: User
        metadata.namespace: default
      excludeUsers:                # optional dotted-path field matcher
        metadata.labels.boards/notifications: 'false'
```

- Parsed by `readRemindersConfig(rootConfig)` in `reminders.ts` into
  typed `ReminderConfig` objects; unknown scope/grouping or a missing
  schedule throws at startup (fail fast).
- `config.d.ts` documents the schema (visibility `backend`).

## Run logic (`runReminder`)

1. `catalog.getEntities({ filter: { kind: 'User', ...userFilter } })`
   using the plugin's own service credentials.
2. Drop users matching `excludeUsers`: every key is a dotted path into
   the entity (labels/annotations keys may themselves contain dots, so
   the path is resolved greedily: descend property by property, but when
   a segment lookup fails, try the remaining path as one literal key —
   which handles `metadata.labels.boards/notifications`).
3. For each remaining user build a `BoardsPrincipal`
   (`userRef` = stringified entity ref, `ownershipRefs` = userRef + the
   entity's `memberOf` relation targets) and call the existing
   `service.listMyItems(principal)` — identical access/archival rules as
   the My-items page.
4. Apply the scope via the shared `dueState` helper.
5. Send notifications (`notificationService.send`, recipient =
   the user's entityRef, severity `high` for overdue scope, link to
   `/boards/<id>` or `/boards/my-items`):
   - `combined`: one message, title like "You have N board item(s)
     needing attention", description listing `title (board, due date)`
     lines (capped at 10 lines, with an "and N more" tail);
   - `per-board`: one message per board with that board's lines and the
     board link.
6. Log a summary (users notified / messages sent); a failure for one
   user logs and continues, never aborts the whole run.

## Scheduling

`scheduleReminders(...)` registers one scheduler task per entry:
id `boards-reminder-<id>`, `frequency: { cron: { expression } }` or
`{ hours: frequencyHours }`, timeout 10 min, initialDelay 1 min.

## Testing

Unit tests with a stubbed catalog and captured notifications: config
parsing (both schedules, defaults, rejection of bad scope), exclude
matcher (label opt-out), scope filtering (overdue vs all), combined vs
per-board message counts, empty-scope users skipped. No live smoke —
the scheduler and notification service are framework-provided; the run
function is exercised directly.

# Standard Scheduler Configuration for Reminders

## Why

Reminders currently accept only a bespoke `cron` or `frequencyHours`
pair. Every other Backstage plugin uses the standard scheduler
configuration shape, which also supports minute-level frequencies
(useful in development: run every 10 minutes), timeouts, initial delays,
and cron — all in one well-known format.

## What Changes

- Each `boards.reminders` entry takes a required `schedule` object in
  the standard Backstage scheduler format, parsed with
  `readSchedulerServiceTaskScheduleDefinitionFromConfig` — e.g.
  `schedule: { frequency: { minutes: 10 }, timeout: { minutes: 5 } }`
  or `schedule: { frequency: { cron: '0 8 * * 1-5' } }`.
- The bespoke `cron` / `frequencyHours` options are removed (breaking
  config change); a missing or invalid `schedule` fails startup with a
  clear error. Default timeout/initialDelay come from the schedule
  itself.

## Impact

- `boards-backend`: `reminders.ts` parsing + scheduling, `config.d.ts`,
  tests; commented sample in `app-config.yaml`.

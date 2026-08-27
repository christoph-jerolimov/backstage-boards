# Watching and Notifications

## MODIFIED Requirements

### Requirement: Configurable item reminders

The backend SHALL support a `boards.reminders` configuration array. Each
entry SHALL define its schedule as a standard Backstage scheduler
configuration object (`schedule`), supporting cron expressions and
human-duration frequencies down to minutes, plus timeout and initial
delay. Each configured reminder SHALL run as its own scheduled task.
Entries without a valid `schedule` SHALL fail startup with a clear
error.

#### Scenario: Independent schedules

- **WHEN** two reminders are configured with different cron expressions
- **THEN** each runs on its own schedule as a separate scheduled task

#### Scenario: Minute-level development schedule

- **WHEN** a reminder is configured with
  `schedule: { frequency: { minutes: 10 } }`
- **THEN** the reminder task runs every 10 minutes

#### Scenario: Cron schedule

- **WHEN** a reminder is configured with
  `schedule: { frequency: { cron: '0 8 * * 1-5' } }`
- **THEN** the reminder task runs on that cron schedule

#### Scenario: Missing schedule rejected

- **WHEN** a reminder entry has no `schedule`
- **THEN** startup fails with an error naming the reminder

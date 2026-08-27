# Design

`ReminderConfig.schedule` becomes a
`SchedulerServiceTaskScheduleDefinition` parsed via
`readSchedulerServiceTaskScheduleDefinitionFromConfig(entry.getConfig('schedule'))`,
wrapped to prefix errors with the reminder id. `scheduleReminders`
spreads the definition into `scheduler.scheduleTask` (frequency,
timeout, initialDelay, scope all honored). `config.d.ts` documents the
`schedule` object loosely (the framework validates the exact shape).

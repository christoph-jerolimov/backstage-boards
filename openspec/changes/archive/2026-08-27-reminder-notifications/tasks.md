# Tasks

## 1. Implementation

- [x] 1.1 `reminders.ts`: config parsing with validation, exclude
      matcher, scope filtering, combined/per-board message building,
      `runReminder` + `scheduleReminders`
- [x] 1.2 Plugin wiring (`rootConfig`, `catalogServiceRef`), dependency
      on `@backstage/plugin-catalog-node`, `config.d.ts` schema

## 2. Verification

- [x] 2.1 Unit tests: parsing, exclusion, scopes, grouping, skip-empty
- [x] 2.2 `yarn tsc`, full test suite, lint; backend starts with a
      sample reminder configured

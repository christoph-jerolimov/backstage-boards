# Relative Due Dates

## Why

"Due Aug 27" forces the reader to know today's date; "Due today" does
not. For dates close to today a relative label communicates urgency
faster.

## What Changes

- Due dates one day around today render relatively: "Due yesterday"
  (error color), "Due today" (warning), "Due tomorrow". All other dates
  keep the absolute short format ("Due Aug 29", "Overdue Aug 20").

## Impact

- `boards-common`: `relativeDueLabel` helper in `dates.ts` + tests.
- `plugins/boards`: `DueDateBadge` uses it (cards, table, drawer,
  My items all render through it).

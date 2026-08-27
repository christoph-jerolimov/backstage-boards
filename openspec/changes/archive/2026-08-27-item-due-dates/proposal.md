# Item Due Dates

## Why

Boards have no notion of time: items cannot express when they need to be
done, so teams track deadlines elsewhere. A due date on items — visible at
a glance on cards and in the table, with clear "due today" and "overdue"
states — makes boards usable for deadline-driven work and is the
foundation for the upcoming reminder notifications.

## What Changes

- Items get an optional `dueDate` (calendar date, no time component),
  stored in the database, exposed through the REST API and the
  actions-registry actions, and tracked in the item change history.
- Kanban cards and the table view show the due date; it renders in a
  warning color when the item is due today and in an error color when it
  is overdue.
- Each card gets a quick due-date menu with: today, tomorrow, this week
  (Friday), and remove.
- The item details drawer lets the user pick any date (or clear it) with
  a date field.

## Impact

- `boards-common`: `BoardItem.dueDate`, shared due-date helpers
  (today/tomorrow/Friday resolution, due-state classification).
- `boards-backend`: migration adding `items.due_date`, service
  validation + change tracking, router/action inputs.
- `boards`: card badge + quick menu, table column, drawer date field.

# Design

## Data model

- Migration `20260827_06_item_due_dates` adds `items.due_date` (string,
  nullable) storing a plain `YYYY-MM-DD` value. No time component: due
  dates are calendar dates interpreted in the viewer's local timezone,
  matching how people talk about deadlines ("due Friday"), and avoiding
  TZ drift bugs from midnight UTC timestamps.
- `BoardItem.dueDate?: string` in `boards-common`.

## Shared helpers (`boards-common/src/dates.ts`)

- `isValidDueDate(value)`: strict `YYYY-MM-DD` + real-calendar check.
- `todayISO(now?)`, `tomorrowISO(now?)`, `fridayISO(now?)`: quick-menu
  targets; `fridayISO` resolves to the Friday of the current week (today
  when today is Friday, otherwise the upcoming Friday — on
  Saturday/Sunday it rolls to next week's Friday).
- `dueState(dueDate, now?)`: `'overdue' | 'today' | 'upcoming'` by string
  comparison against local today — safe because both sides are
  `YYYY-MM-DD`.

All helpers take an optional `now` for testability.

## Backend

- `updateItem` accepts `dueDate?: string | null`, validates with
  `isValidDueDate`, records a `field: 'dueDate'` change entry (existing
  change plumbing), rejects on externally managed items like other
  fields.
- Router `PATCH .../items/:itemId` and the `update-item` action pass
  `dueDate` through (`null` clears).

## Frontend

- `DueDateBadge` component: renders the date compactly (`Due Aug 29`,
  locale short format); colors via inline style using BUI status tokens
  (`--bui-fg-danger` / warning fallback hexes consistent with existing
  danger styling); tooltip-free, the table also shows it.
- Kanban card: badge under the title row; a small calendar `ButtonIcon`
  (remix `RiCalendarLine`) opens a BUI `Menu` with Today / Tomorrow /
  This week (Fri) / Remove — only rendered for users with write access,
  wired to the existing optimistic update path (`updateItem` +
  invalidate).
- Table view: new "Due" column (sortable, string sort works for ISO
  dates) rendering the same badge.
- Item drawer: native `<input type="date">` styled like the drawer's
  inline fields (BUI has no DatePicker in 0.17 that fits inline use —
  check `DatePicker` first; if present and controlled, prefer it),
  committing on change; clear button removes the date.

## Testing

- Unit tests for the date helpers (Friday resolution incl. weekend edge,
  validation, due-state boundaries) and service-level dueDate
  set/clear/validation/change-history tests.
- Playwright smoke: quick-menu sets today (warning color), overdue item
  seeded via API shows error color, drawer date field sets arbitrary
  date.

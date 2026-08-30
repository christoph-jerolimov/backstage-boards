## Context

Filtering lives in three layers that already agree on one type:
`ItemFilter` in `plugins/boards-common/src/filter.ts` with
`itemMatchesFilter`/`isEmptyFilter`, the `useItemFilter` hook +
`ItemFilterBar` component on the frontend (board page and my-items page),
and `BoardsService.listItems` which translates the same filter into SQL
for the API. Due-date urgency is classified by `dueState` in
`plugins/boards-common/src/dates.ts` ("overdue" = `dueDate < todayISO()`
by plain string comparison of `YYYY-MM-DD`).

## Goals / Non-Goals

**Goals:**
- One toggle, zero configuration, live count, both views, my-items too.
- Filter-pipeline parity: shared matcher and API accept the same flag.

**Non-Goals:**
- No "due today"/"due this week" quick filters (the group-by and menus
  cover those needs); one chip only.
- No persistence of the toggle across sessions.

## Decisions

- **`overdue?: boolean` on `ItemFilter`** — optional so every existing
  call site stays valid; `isEmptyFilter` treats `true` as active;
  `itemMatchesFilter` matches when the item has a due date and
  `dueState(dueDate) === 'overdue'`.
- **Chip = small tertiary Button** like the other filter controls, with
  a `✓ ` prefix while active (matching the menus' marker language),
  labelled `Overdue (n)` where n counts overdue items among the
  unfiltered input items. Hidden when n is 0 and the toggle is off; kept
  visible while active even if n drops to 0 so the user can switch it
  off again.
- **Backend**: `overdue=true` query parameter adds
  `where items.due_date < todayISO()` — same semantics as the string
  comparison in `dueState`.

## Risks / Trade-offs

- "Today" is the server's local day for the API and the browser's local
  day in the UI; they can differ around midnight across time zones. The
  due-date feature already lives with this (urgency colors are computed
  client-side), so the chip follows the existing convention.

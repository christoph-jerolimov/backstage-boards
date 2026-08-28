## Why

The board answers "what is in this column?" and "what does this person
carry?" one at a time, but never both at once. Group-by-assignee splits
every lane into swimlanes, which reads well for a handful of items and
turns into a scrolling exercise on a real board: to learn that Bob has
four items in progress and none in review, you count cards.

The distribution of work across people and statuses is exactly the
question a standup or a workload check asks — and the board already
answers the same shape of question for priorities. `board-item-priorities`
shipped a status × priority matrix with clickable badges that take a
status or a priority out of the sums; the identical view over people is
missing, even though assignees are the axis a team actually plans on.

## What Changes

- Add an "Assignee matrix…" entry to the board's actions menu, opening a
  new dialog: one column per board column (status), one row per assignee,
  plus a trailing "Unassigned" row when unassigned items exist.
- Each cell shows the number of items with that status carrying that
  assignee. An item with several assignees counts once in each of their
  rows — the same rule group-by-assignee already applies — so the overall
  total can exceed the item count; the dialog says so.
- A trailing sum column, a bottom sum row, and an overall total where
  they meet, computed over the selected combinations only.
- Status headers and assignee headers are clickable and start selected.
  Unselecting one excludes it from the sum column, the sum row, and the
  overall total while its own cells keep their counts — the behavior the
  priority matrix already defines, so the two dialogs read identically.
- Extract the table, the toggle badges, and the sum arithmetic that
  `PriorityMatrixDialog` implements today into one shared matrix
  component, and build both dialogs on it, so the two cannot drift apart.
- The matrix counts the items the board is currently showing, so an
  active search, tag, or assignee filter narrows it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: gains an "Assignee and status matrix dialog"
  requirement covering the new dialog — its axes, the multi-assignee
  double count, the sums, and the exclusion toggles. It sits beside the
  existing "Board view and table view" and "Group items by assignee"
  requirements, which it complements rather than replaces.
- `boards/item-priorities` keeps its "Status and priority matrix dialog"
  requirement **unchanged**: sharing the implementation with the new
  dialog is a refactor, and the priority matrix's behavior — including
  its gating on boards that define priorities — stays exactly as
  specified.

## Impact

- **Frontend only**, in `plugins/boards`: a new `MatrixTable` extracted
  from `PriorityMatrixDialog.tsx`, a new `AssigneeMatrixDialog.tsx` built
  on it, both dialogs' tests, a second matrix kind in `BoardDialogs.tsx`,
  and a menu entry in `BoardHeader.tsx`. `BoardPage` already passes its
  filtered items to `BoardDialogs` for the priority matrix, so the new
  dialog needs no new data.
- **No backend, API, or database change.** Every number is derived from
  the items the board page has already loaded, so the dialog issues no
  request of its own beyond the catalog profile lookup the assignee
  labels share with the filter bar and the card avatars.
- **No migration, no config, no new dependency.**

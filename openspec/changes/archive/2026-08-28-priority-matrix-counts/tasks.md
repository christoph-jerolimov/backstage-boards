# Tasks — priority-matrix-counts

## 1. Matrix rework

- [x] 1.1 Rework `PriorityMatrixDialog.tsx`: replace per-cell item buttons with per-combination counts, drop the `onOpenItem` prop (and its `BoardDialogs.tsx` wiring), and add the sum column, sum row, and overall total; verify with `yarn tsc` and the updated dialog test.
- [x] 1.2 Make the status and priority header badges toggle buttons (`aria-pressed`, dimmed when unselected, all selected by default, "No priority" row included) whose selection excludes that status/priority from the sum column, sum row, and total while cell counts stay visible; verify with dialog tests.

## 2. Tests and verification

- [x] 2.1 Rewrite `PriorityMatrixDialog.test.tsx` to cover the delta-spec scenarios: counts without item buttons, sum row/column/total, toggling a status and a priority out and back in, and the "No priority" row participating in sums; verify the suite passes.
- [x] 2.2 Run `yarn tsc`, `yarn lint`, `yarn prettier:check`, and the `plugins/boards` test suite; verify all pass.

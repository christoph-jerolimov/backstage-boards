## 1. Shared model and backend

- [x] 1.1 Add `wipSoftLimit`/`wipHardLimit` to `BoardColumn`, a shared
      `wipState` helper with unit tests, and the `board_columns`
      migration; verify migrations run in the backend test setup.
- [x] 1.2 Accept and validate the limits in
      `addColumn`/`updateColumn` (integer ≥ 1, soft ≤ hard, null
      clears) and expose them through the router; verify with service
      tests for valid, invalid, and clearing updates.
- [x] 1.3 Enforce the hard limit in `createItem` and `moveItem`
      (cross-column only) with a `ConflictError`; verify with service
      tests covering create-into-full, move-into-full, reorder-within,
      and move-out.

## 2. Frontend

- [x] 2.1 Extend the frontend `BoardsApi.updateColumn`/`addColumn`
      types and add a "WIP limits" column-menu entry opening a dialog
      with two optional number fields; verify with a BoardView test
      saving limits.
- [x] 2.2 Render the header count as `n/limit` with warning/error
      backgrounds from `wipState` over unfiltered counts; verify with
      BoardView tests for ok/soft/hard states.
- [x] 2.3 Disable entry into hard-full columns: add-item row, item
      menu and flat picker entries, status selects, keyboard moves,
      and lane drops; verify with component tests for menu disabling
      and add-row disabling.

## 3. Docs

- [x] 3.1 Update README (configurable columns bullet) and
      `docs/features/board.md` with the WIP limits behavior and verify
      the wording matches.

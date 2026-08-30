## 1. Order and state

- [x] 1.1 Lift the table sort state into `BoardPage` (controlled
      `sort`/`onSortChange` on `TableView`) and verify the table tests
      still pass.
- [x] 1.2 Compute the drawer walk order in `BoardPage` for both views
      and verify with a unit-level test through the drawer navigation.

## 2. Drawer controls

- [x] 2.1 Add the nav prop, header arrows with "n of m", and j/k keys
      (editable-target guard) to `ItemDrawer`; verify with drawer
      tests for buttons, keys, typing guard, and end disabling.
- [x] 2.2 Wire it up in `BoardPage` and verify with a BoardPage test
      walking items.

## 3. Docs

- [x] 3.1 Document the navigation in `docs/features/item-details.md`
      and the README keyboard bullet; verify wording.

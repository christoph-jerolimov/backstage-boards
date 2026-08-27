# Tasks

## 1. Shared menu plumbing

- [ ] 1.1 Extract `ItemActions` (openItem, moveItem, setItemDueDate,
      setAssignees, deleteItem) in `ItemMenu.tsx`; make `BoardActions`
      in `BoardView.tsx` extend it and drop `ItemMenu`'s type import
      from `BoardView`
- [ ] 1.2 `ItemMenu` takes `actions: ItemActions` and an optional
      `extraItems?: ReactNode` rendered after "Open details";
      `ItemContextMenu` passes it through
- [ ] 1.3 `queries.ts`: add `queryKeys.myItems` and an
      `invalidateMyItems(client)` helper; use the key in `MyItemsList`

## 2. My-items table

- [ ] 2.1 `BoardGroupTable` resolves its board with `useBoardQuery`,
      derives `readonly` (write access, archived board, external
      manager) and the group's assignee pool
- [ ] 2.2 Build the group's `ItemActions` from `boardsApi` bound to the
      board id (move, due date, assignees, delete; openItem navigates to
      the board with the item open), invalidating the board and my-items
      caches after each action and surfacing failures in the listing's
      error slot
- [ ] 2.3 Replace `MyItemMenu` with `ItemMenu` in both the row actions
      menu and the right-click menu, passing "Open board" as
      `extraItems`
- [ ] 2.4 Status cell renders `StatusBadge` from the resolved column,
      falling back to the entry's `columnTitle` badge while the board
      loads

## 3. Verification

- [ ] 3.1 Update `MyItemsPage.test.tsx`: menu shows Open details, Move
      to column, Due date, Assignee, Delete item and Open board; row
      actions call the API with the group's board id; read-only board
      and externally managed item show only the navigation entries
- [ ] 3.2 `ItemMenu.test.tsx` covers `extraItems` rendering
- [ ] 3.3 `yarn tsc`, unit tests, lint
- [ ] 3.4 Playwright smoke on the boards page "My items" tab: move an
      item to another column and see the status cell follow; set a due
      date; unassign yourself and see the row leave the listing

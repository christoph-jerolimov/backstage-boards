# Tasks

## 1. Shared types and helpers

- [ ] 1.1 Add `BoardPriority` (`id`, `boardId`, `name`, `color?`,
      `order`), `PriorityColor` as an alias of the existing palette
      type, `priorities` on `BoardWithContext`, `priorityId` on
      `BoardItem`/`NewItem`/`ItemUpdate`, and resolved `priority` on
      `MyBoardItem` in `plugins/boards-common/src/types.ts`; verify
      `yarn tsc` passes across all three packages
- [ ] 1.2 Add `priorityIds?: string[]` with the `'none'` sentinel to
      `ItemFilter`, extend `itemMatchesFilter` (OR within priorities,
      AND against text and tags) and `isEmptyFilter`; verify new cases
      in `plugins/boards-common/src/filter.test.ts` pass

## 2. Database and backend service

- [ ] 2.1 Add migration `20260828_09_board_priorities` creating
      `board_priorities` and the nullable `items.priority_id`, with a
      `down` that reverses both; verify `migrations.test.ts` passes
      up and down on a fresh and a populated database
- [ ] 2.2 Load a board's priorities in `getBoard` (ordered by
      `order_number`) and `priorityId` in `hydrateItems`; verify a
      `BoardsService` test asserts both round-trip
- [ ] 2.3 Seed the default priorities (critical/red, high/orange,
      medium, low) in `createBoard`; verify a test asserts the four
      names, colors, and order numbers 1–4 on a newly created board
- [ ] 2.4 Implement `listPriorities`, `addPriority` (admin, max 10,
      non-empty name, appended with the next order number),
      `updatePriority` (name and color), and `reorderPriorities` (full
      ordered id list, rejects a list that is not the board's exact
      set, renumbers 1..N); verify tests cover the cap, the empty name,
      the non-admin rejection, and renumbering after a move
- [ ] 2.5 Implement `deletePriority` with `reassignTo` (another
      priority of the board) or an explicit drop, rejecting an
      unqualified removal of a priority still in use with a conflict
      error and renumbering afterwards; verify tests cover unused,
      reassign, drop, and the rejection
- [ ] 2.6 Accept `priorityId` in `createItem` and `updateItem`,
      validating that it belongs to the item's board, and record the
      change as field `priority` with old/new priority names; verify
      tests cover setting, clearing, the foreign-priority rejection,
      and the history entry
- [ ] 2.7 Apply `priorityIds` in `listItems`' SQL (`whereIn` plus
      `whereNull` for the sentinel); verify a test asserts the same
      result set as `itemMatchesFilter` for the same filter
- [ ] 2.8 Resolve each entry's priority in `listMyItems`; verify a test
      asserts an assigned item's entry carries name, color, and order
- [ ] 2.9 Copy priorities in `duplicateBoard` (replacing the default
      set) and map copied items' `priority_id` through the id map in
      `copyItemsInto`; verify tests assert the copy's priority list and
      a copied item's priority
- [ ] 2.10 Emit the board signal on every priority mutation; verify a
      test asserts a signal for add, update, reorder, and delete

## 3. Backend HTTP surface

- [ ] 3.1 Add the routes `GET`/`POST /boards/:boardId/priorities`,
      `PATCH`/`DELETE /boards/:boardId/priorities/:priorityId` (delete
      taking `reassignTo`), and `PUT /boards/:boardId/priorities/order`;
      verify `router.test.ts` covers each status code including the
      409 on an unqualified delete
- [ ] 3.2 Accept repeated `?priority=` on `GET /boards/:boardId/items`
      alongside `text` and `tag`; verify a router test filters by two
      priorities and by the no-priority sentinel
- [ ] 3.3 Add optional `priorityId` to the update-item action in
      `plugins/boards-backend/src/actions.ts`; verify `actions.test.ts`
      covers setting and clearing it

## 4. Frontend API client and queries

- [ ] 4.1 Add `listPriorities`, `addPriority`, `updatePriority`,
      `reorderPriorities`, and `deletePriority` to `BoardsApi` and
      `BoardsClient`, and `priorityId` to the item update paths; verify
      `api.test.ts` asserts the request method, path, and body of each
- [ ] 4.2 Add a `setItemPriority` action to `BoardActions`/`ItemActions`
      wired through `BoardPage` and `MyItemsPage`, invalidating the
      board and my-items queries; verify the existing query tests still
      pass with the added action

## 5. Priority rendering, grouping, filtering

- [ ] 5.1 Add a `PriorityBadge` component (name plus color dot, neutral
      when the priority has no color, nothing when the item has none)
      reusing the palette hexes; verify a component test covers the
      colored, uncolored, and absent cases
- [ ] 5.2 Add `'priority'` to `GroupByMode`, extend `groupItems` with
      the board's priorities to order groups by order number with a
      `NO_PRIORITY` group last and skip empty groups, and extend
      `GroupLabel` to render a priority group's name and count; verify
      `grouping.test.ts` covers order, the no-priority group, and
      filtered-away groups
- [ ] 5.3 Add `'priority'` to `ItemSortDescriptor` and sort by order
      number with unprioritized items last in both directions; verify
      `grouping.test.ts` (sortItems) covers both directions

## 6. Board surfaces

- [ ] 6.1 Add the priority editor to `BoardSettingsDialog` for admins:
      list in order with rename, color picker, move up/down, add
      (disabled at 10), and a remove flow that offers reassign-or-drop
      when the priority is in use; verify
      `BoardSettingsDialog.test.tsx` covers add, rename, reorder, and
      both removal choices
- [ ] 6.2 Show the priority badge on board cards in `BoardView`; verify
      a `BoardView.test.tsx` case asserts the badge for an item with a
      priority and none for an item without
- [ ] 6.3 Add the sortable Priority column to `TableView`, rendered only
      when the board has priorities; verify `TableView.test.tsx` covers
      both boards
- [ ] 6.4 Add the priority filter menu to `BoardPage`'s filter bar
      (order ascending, then "No priority", each with its item count,
      cleared by "Clear filters") and the "By priority" group-by option,
      both only when the board has priorities; verify
      `BoardPage.test.tsx` covers filtering, the counts, and the hidden
      controls on a board without priorities
- [ ] 6.5 Add the priority submenu to `ItemMenu` (priorities in order
      plus a clear entry) gated on write access and the board having
      priorities, and pass the board's priorities from every call site;
      verify `ItemMenu.test.tsx` covers setting, clearing, the
      read-only case, and the board-without-priorities case
- [ ] 6.6 Add the priority control to `ItemDrawer` next to the status
      select, shown only when the board has priorities; verify
      `ItemDrawer.test.tsx` covers setting and clearing

## 7. Cross-board surfaces

- [ ] 7.1 Show the priority column in `MyItemsPage`'s per-board tables
      when that board has priorities (falling back to "any entry carries
      one" while the board query is pending) and offer the priority
      submenu in its row menu; verify `MyItemsPage.test.tsx` covers the
      column gating and a priority change from the row menu
- [ ] 7.2 Show the priority badge in `AssignedItemsWidget` rows; verify
      `AssignedItemsWidget.test.tsx` asserts the badge for an entry with
      a priority and none for one without

## 8. Priority matrix

- [ ] 8.1 Add `PriorityMatrixDialog`: rows per priority in order plus a
      final "No priority" row, columns per board column in board order,
      cell counts over the board's non-archived unfiltered items, with
      row, column, and grand totals and zeros in empty cells; verify a
      component test asserts the counts and totals for a fixture board
- [ ] 8.2 Add the "Priority matrix…" entry to the board more-menu, shown
      only when the board has priorities; verify `BoardPage.test.tsx`
      covers the entry's presence, absence, and that it opens the dialog

## 9. Verification

- [ ] 9.1 Run `yarn tsc`, `yarn test:all`, `yarn lint:all`, and
      `yarn prettier:check` and fix everything they report
- [ ] 9.2 Smoke-test in the running app: create a board and confirm the
      four default priorities; rename, recolor, reorder, and remove one
      with both reassign and drop; set and clear an item's priority from
      the card menu and the drawer; filter and group by priority; open
      the matrix; confirm the my-items table, the home page card, and a
      board with all priorities removed all render correctly

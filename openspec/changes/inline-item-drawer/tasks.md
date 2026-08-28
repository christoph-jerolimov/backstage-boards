# Tasks

## 1. Reusable drawer chrome

- [ ] 1.1 Extract the backdrop and right-hand panel from `ItemDrawer.tsx`
      into an exported `ItemDrawerShell({ ariaLabel, onClose, children })`
      in the same file, moving the Escape listener and the
      backdrop-click close into it, and render the existing drawer body
      inside it. Verify `ItemDrawer.test.tsx` passes unchanged — same
      `role="dialog"`, same `Item <title>` label, same Escape and
      backdrop close behavior.
- [ ] 1.2 Add the optional `onOpenBoard?: () => void` prop to
      `ItemDrawer`; when given, render `On board <board.name>` under the
      header with the name as a tertiary button that calls it. Verify
      with tests that the affordance is absent without the prop and that
      activating it calls the callback exactly once.

## 2. `ItemDrawerHost`

- [ ] 2.1 Add `components/ItemDrawerHost.tsx` with
      `ItemDrawerHost({ boardId, itemId, onClose, onOpenBoard? })`: run
      `useBoardQuery` and `useItemsQuery`, derive `canWrite` as
      `levelIncludes(board.access, 'write') && !board.archivedAt` and
      `tagSuggestions` from the board's items, and render `ItemDrawer`
      with `onChanged` invalidating through `invalidateBoard`. Verify
      with tests that a ready host renders the drawer with the item's
      title, that a read-only board renders no editing affordances, and
      that `onOpenBoard` is forwarded.
- [ ] 2.2 Render the loading, board-error and item-not-found states
      inside `ItemDrawerShell`, each closable. Verify with tests: a
      pending board query shows a loading message; a failing board query
      shows the error; a loaded board whose items do not contain the id
      shows the "no longer on the board" message; each closes via the
      close button, Escape, and the backdrop.

## 3. List refresh after an item edit

- [ ] 3.1 Add `myItems: ['boards', 'my-items']` and
      `boardLists: ['boards', 'list']` to `queryKeys`, use `myItems` in
      `MyItemsList` and `AssignedItemsContent` in place of the inline
      key, and invalidate both from `invalidateBoard` (the listing key
      by prefix). Verify with a `queries.test.tsx` case that
      `invalidateBoard` marks a my-items entry and each of the four
      board-listing option entries stale while leaving an unrelated
      board's entries untouched.

## 4. My items page and tab

- [ ] 4.1 In `MyItemsList`, read `board` and `item` from
      `useSearchParams` and render `ItemDrawerHost` for them with
      `onOpenBoard` navigating to `<base>/<boardId>`; make row
      activation and the menu's "Open item" set both parameters instead
      of navigating, and closing delete them. Keep "Open board"
      navigating. Verify with tests: clicking a row opens the drawer
      without navigating; the parameters appear and are removed again on
      close; "Open board" still navigates; a render with the parameters
      already set opens the drawer immediately.
- [ ] 4.2 In `BoardListPage`, initialize the selected tab to `my-items`
      when an `item` search parameter is present. Verify with a test
      that rendering `/boards?board=…&item=…` selects the My items tab
      with the drawer open, and that rendering without the parameters
      still selects Favorites.

## 5. Assigned items card

- [ ] 5.1 In `AssignedItemsContent`, hold the open item in component
      state, open it from the item row instead of navigating, and render
      `ItemDrawerHost` with `onOpenBoard` navigating to
      `<base>/<boardId>`. Keep the board group heading navigating.
      Verify with tests: activating an item opens the drawer and calls
      no navigation; the board heading still navigates; closing returns
      to the plain card; two rendered cards do not share the open item.

## 6. Verification

- [ ] 6.1 Run `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full` and
      `yarn test:all`; all pass with the new tests included.
- [ ] 6.2 Extend `plugins/boards/e2e-tests/home-widgets.test.ts` with a
      case that opens an item from the "Assigned items" card, changes its
      status in the drawer, closes it, and asserts the card shows the new
      status while the address is still the home page.
- [ ] 6.3 Add a Playwright case covering the my-items listing: open an
      item from a row, assert the address carries the board and item and
      the listing is still behind the drawer, reload and assert the
      drawer reopens, then close it and assert the parameters are gone.
- [ ] 6.4 Start the app (`yarn start`) and check by hand that the drawer
      opened over the home page and over the my-items listing is fully
      visible next to the Backstage sidebar and header, that its
      pickers (assignee, tags, status) open above the overlay, and that
      the browser's back button closes the my-items drawer.

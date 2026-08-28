# Tasks

## 1. Grouping and filtering helpers

- [ ] 1.1 Widen `MyItemsGroupBy` in `plugins/boards/src/components/grouping.ts`
      to `'none' | 'board' | 'status' | 'dueDate' | 'tags'` and handle the
      two new modes in `groupMyItems`: `none` returns one
      `{ key: 'all', label: '', entries }` group; `tags` returns one group
      per tag ordered alphabetically, an entry in each of its tag groups,
      and a trailing `UNTAGGED` group labelled "Untagged". Leave `board`,
      `status` and `dueDate` untouched. Verify with `grouping.test.ts`
      cases for: `none` yielding a single group with every entry; a
      two-tag entry appearing in both tag groups; untagged entries last;
      tag groups sorted; and the existing board/status/due-date cases
      still passing unchanged.
- [ ] 1.2 Add `MyItemsFilter`, `isEmptyMyItemsFilter(filter)` and
      `filterMyItems(entries, filter)` to `grouping.ts` per design.md §1 —
      text and tags delegated to `itemMatchesFilter(entry.item, …)` from
      `@internal/plugin-boards-common`, assignees matched case-insensitively
      against `entry.item.assignees` with OR semantics. Do not change
      `ItemFilter` in `boards-common`. Verify with unit tests for: empty
      filter returning everything; text matching title and description
      case-insensitively; two tags requiring both; one assignee ref
      excluding the others; two assignee refs keeping either; assignee
      matching ignoring ref casing; and text + tags + assignee combining.
- [ ] 1.3 Add `myIdentityAssignees(entries, identityRefs)` to `grouping.ts`:
      the de-duplicated identity refs (case-insensitive) that appear on at
      least one entry, sorted by their display label. Verify with unit
      tests for: only refs present on entries returned; a colleague's ref
      on a shared item not returned; casing differences collapsed to one
      option; and an empty result when the identity has no refs.

## 2. Shared filter-bar components

- [ ] 2.1 Move `assigneeLabel` from `components/ItemMenu.tsx` to
      `components/common.tsx` and export it, updating `ItemMenu`'s import.
      Verify with the existing `ItemMenu.test.tsx` passing unchanged and a
      `common.test.tsx` case covering an entity ref, a `text:` ref and an
      unparseable ref.
- [ ] 2.2 Add `components/FilterBar.tsx` exporting `MultiSelectFilterMenu`
      (`label`, `ariaLabel`, `options: {value,label}[]`, `selected`,
      `onChange`) — a `MenuTrigger` + `Menu` rendering `Label (n)` when
      any option is selected and a `✓ ` prefix on selected entries, exactly
      as `BoardPage`'s tag menu does today. Verify with component tests
      for: toggling an option on and off through `onChange`; the count in
      the button label; and no count when nothing is selected.
- [ ] 2.3 Refactor `BoardPage.tsx`'s inline tag menu to use
      `MultiSelectFilterMenu`, changing no behavior. Verify by running
      `BoardPage.test.tsx` **unmodified** — it is the regression check for
      the extraction.

## 3. My items filter bar

- [ ] 3.1 In `MyItemsList` (`components/MyItemsPage.tsx`) add
      `filterText` / `filterTags` / `filterAssignees` state and render the
      filter bar above the listing: a `SearchField` labelled "Search
      items", the tag `MultiSelectFilterMenu` over the tags in use on the
      loaded entries (hidden when there are none), and — while a filter is
      active — an "N of M items" count and a "Clear filters" button, in
      the same layout `BoardPage` uses. Verify with `MyItemsPage.test.tsx`
      cases: typing text narrows the rows; selecting two tags requires
      both; the count reflects matches; "Clear filters" restores every
      row; and no count or clear button is shown with no filter active.
- [ ] 3.2 Read the viewer's identity with `identityApiRef` +
      `useAsyncData` and render the assignee `MultiSelectFilterMenu` only
      when `myIdentityAssignees` returns two or more refs, labelled with
      `assigneeLabel`. Verify with tests for: menu shown for a viewer with
      a user ref and a group ref both present on entries; menu absent when
      only one ref is in play; selecting the group ref hiding personally
      assigned items; and the menu absent (with the rest of the bar
      working) when the identity call rejects.
- [ ] 3.3 Apply `filterMyItems` in a `useMemo` before grouping, and render
      "No items match your filters." when filtering empties the listing,
      keeping the existing "Nothing is assigned to you on any board."
      message for a genuinely empty result. Verify with tests asserting
      each message appears in its own case and that a board whose items
      are all filtered out renders no group heading.

## 4. My items grouping control

- [ ] 4.1 Add `groupBy` state defaulting to `'board'` and a `Select`
      labelled "Group by" with the options "By board", "Not grouped", "By
      due date" and "By tags", placed with the filter bar. Replace the
      local `groupByBoard` helper with `groupMyItems(entries, groupBy)`.
      Verify with tests: the default rendering is grouped by board and
      unchanged from today; switching to due date orders overdue first
      with "No due date" last; switching to tags shows a two-tag item
      under both tags and an "Untagged" group last; and "Not grouped"
      renders one table with no group heading.
- [ ] 4.2 Render group headings per design.md §4 — board name as the
      existing link plus entry count, relative due-date labels via
      `relativeDueLabel` / `formatDueDate`, the tag itself, "Untagged" and
      "No due date" — and add the `Board` column (a link to the board) to
      the table whenever `groupBy !== 'board'`. Verify with tests
      asserting: the board column is absent when grouped by board and
      present with a working link in each other mode; and that a due-date
      heading reads "Overdue"/"Due today" rather than a raw ISO date.

## 5. Verification

- [ ] 5.1 Run `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full` and
      `yarn test:all`; all pass with the new tests included and no
      existing test modified except where a task above says so.
- [ ] 5.2 Start the app and check the two entry points by hand: `/boards`
      → "My items" tab and the `/boards/my-items` page both show the
      filter bar and the group-by dropdown, the assignee menu appears only
      for a user whose items arrive through more than one of their refs,
      and the home page "Assigned items" card is unchanged.

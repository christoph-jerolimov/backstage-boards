# Tasks

## 1. Grouping helpers

- [ ] 1.1 In `plugins/boards/src/components/grouping.ts` widen
      `MyItemsGroupBy` to
      `'none' | 'board' | 'status' | 'dueDate' | 'tags'` and export
      `MY_ITEMS_PAGE_GROUP_BY = ['board', 'none', 'dueDate', 'tags']` as
      the page's menu order. Handle the new modes in `groupMyItems`:
      `none` returns one `{ key: 'all', label: '', entries }` group;
      `dueDate` and `tags` derive their keys from the existing
      `groupKeysOf(entry.item, mode)` / `REST_KEY[mode]` rather than
      restating the rules, so both pages group alike; `board` and
      `status` keep today's behavior and ordering. Verify with
      `grouping.test.ts` cases for: `none` yielding one group with every
      entry; a two-tag entry appearing in both tag groups; untagged
      entries in a trailing `UNTAGGED` group; tag groups sorted
      alphabetically; and the existing board/status/due-date cases still
      passing unchanged.

## 2. The shared filter bar

- [ ] 2.1 Rename `components/BoardFilterBar.tsx` to
      `components/ItemFilterBar.tsx` and the component to `ItemFilterBar`,
      keeping `useItemFilter`, `ItemFilterHandle` and `AssigneeOption`
      as they are, and update `BoardPage.tsx`. Verify by running
      `BoardPage.test.tsx` **unmodified** — it is the regression check for
      the rename.
- [ ] 2.2 Add `minAssigneeOptions?: number` (default `1`) to
      `ItemFilterBar`, rendering the assignee menu only when
      `assigneeOptions.length >= minAssigneeOptions`, with a comment
      saying why my-items needs `2`. Verify with component tests: default
      shows the menu for a single assignee option; `minAssigneeOptions={2}`
      hides it for one option and shows it for two; and the tag menu and
      count are unaffected either way.

## 3. Per-row board resolution

- [ ] 3.1 Add `useBoardsQueries(boardIds: string[]): Map<string, Board>`
      to `queries.ts`, built on TanStack `useQueries` over
      `queryKeys.board(id)` and `boardsApi.getBoard(id)` — the same key
      `useBoardQuery` uses, so cached boards cost nothing. Verify with a
      `queries.test.tsx` case asserting one entry per distinct id, that a
      duplicate id is queried once, that an empty list issues no query,
      and that a board already in the cache is not refetched.
- [ ] 3.2 Turn `BoardGroupTable` into
      `MyItemsTable({ entries, boards, basePath, showBoardColumn, onError })`
      in `MyItemsPage.tsx`: each row looks its board up in the map for the
      `StatusBadge`, the `canWrite` check and an `ItemActions` bound to
      `entry.boardId`; `useRowMenu` becomes `useRowMenu<MyBoardItem>` so
      its children reach the entry's board; the quick-assign pool is
      computed once from all entries. A row whose board is not (yet)
      resolved keeps today's fallback — the listing's `columnTitle` in a
      plain `Badge` and no write actions. Verify with `MyItemsPage.test.tsx`
      cases: the row menu of two items from different boards each offers
      its own board's columns; a move from a row updates the right board;
      a read-only board's row offers no write actions while another row
      does; and the fallback badge renders before the boards resolve.

## 4. Filter bar on my items

- [ ] 4.1 In `MyItemsList` call `useItemFilter` over
      `entries.map(entry => entry.item)`, render
      `<ItemFilterBar filter={filter} minAssigneeOptions={2} />` above the
      listing, and filter the entries with
      `itemMatchesFilter(entry.item, filter.filter)` in a `useMemo`
      before grouping. Verify with tests: typing text narrows the rows;
      two tags require both; two assignees keep either; the count reads
      "N of M items"; "Clear filters" restores every row; and a board
      whose items all filter out renders no group heading.
- [ ] 4.2 Make the empty state filter-aware — keep "Nothing is assigned to
      you on any board." when no filter is active and show "No items match
      your filters." when one is. Verify with a test for each message.
- [ ] 4.3 Verify the assignee menu rule end to end: shown when the
      entries carry two assignees (the user and a group, or a shared
      item's colleague), absent when they all carry the same one.

## 5. Grouping control on my items

- [ ] 5.1 Add `groupBy` state defaulting to `'board'` and a `Select`
      labelled "Group by" with "By board", "Not grouped", "By due date"
      and "By tags", validated with
      `selectedOption(key, MY_ITEMS_PAGE_GROUP_BY)`. Replace the local
      `groupByBoard` helper with `groupMyItems(filteredEntries, groupBy)`.
      Verify with tests: the default rendering is grouped by board and
      unchanged from today; due date orders overdue first with "No due
      date" last; tags show a two-tag item under both tags with
      "Untagged" last; and "Not grouped" renders one table with no
      heading.
- [ ] 5.2 Render the headings per design.md §6 — the board link button
      with its entry count for `board`, nothing for `none`, and
      `<GroupLabel mode={groupBy} groupKey={group.key} />` for `dueDate`
      and `tags` — and pass `showBoardColumn={groupBy !== 'board'}` so the
      table carries a leading Board column linking to the board in every
      other mode. Verify with tests asserting: no board column when
      grouped by board, a working board link in each other mode, and a
      due-date heading reading "Due today"/"Overdue" rather than a raw
      ISO date.

## 6. Verification

- [ ] 6.1 Run `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full` and
      `yarn test:all`; all pass with the new tests included and no
      existing test modified except where a task above says so.
- [ ] 6.2 Extend `plugins/boards/e2e-tests/my-items-menu.test.ts` (or add
      a sibling spec) with a pass over the new controls: search narrows
      the listing, switching the grouping to tags regroups it and shows
      the board column, and the row menu still opens on a regrouped row.
- [ ] 6.3 Start the app and check both entry points by hand: `/boards` →
      "My items" tab and `/boards/my-items` show the filter bar and the
      group-by dropdown, the assignee menu appears only with more than one
      assignee in the listing, the board page's own filter bar is
      unchanged, and the home page "Assigned items" card still groups by
      its own setting.

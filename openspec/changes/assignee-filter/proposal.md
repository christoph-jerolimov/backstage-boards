## Why

The board filter bar offers free-text search and a tag filter, and the
board can be grouped by assignee — but there is no way to filter to the
work of one person. On a board with more than a handful of items, "what
is Bob still holding?" today means either grouping by assignee and
scrolling to their group (which keeps every other group on screen) or
typing a name into the search field, which matches titles and
descriptions and therefore misses items assigned to Bob that never
mention Bob.

The board already knows every assignee it uses: `groupByAssignee` derives
exactly that set for the group-by mode, and `AssigneeAvatars` already
resolves those refs to display names and pictures. An assignee dropdown
next to the tag dropdown reuses both.

## What Changes

- Add an "Assignees" dropdown to the board filter bar, next to the tag
  dropdown, listing every assignee used by the board's items —
  `user:`/`group:` refs by their catalog display name, `text:` refs by
  their display text — sorted alphabetically by label. The dropdown is
  hidden when no item on the board has an assignee, exactly as the tag
  dropdown is hidden when no item is tagged.
- Selecting assignees narrows the item set to items assigned to **any**
  of them (OR), unlike the tag filter's all-of semantics: a person is on
  a card or they are not, and asking for items assigned to two people at
  once is almost never the question being asked.
- The assignee filter combines with the text and tag filters by AND,
  applies to both the board and the table view, contributes to the
  "N of M items" counter, and is reset by "Clear filters" — the button
  appears when an assignee is selected even with no other filter active.
- Extend the shared `ItemFilter` with `assignees?: string[]`, honored by
  `itemMatchesFilter` and `isEmptyFilter`, and by the items API as a
  repeatable `?assignee=` query parameter, so the API keeps accepting
  the same filters the UI offers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: "Filter and search items" gains the assignee
  filter — its dropdown contents, its any-of matching, its combination
  with the existing filters, and the matching API parameter.

## Impact

- **Frontend.** `plugins/boards/src/components/BoardPage.tsx`: the filter
  bar and one more piece of filter state. `AssigneeAvatars.tsx`: its
  private `useProfiles` hook moves to a shared module so the dropdown
  labels and the card avatars resolve names the same way.
- **Common.** `plugins/boards-common/src/filter.ts`: `ItemFilter`,
  `itemMatchesFilter`, `isEmptyFilter`.
- **Backend.** `plugins/boards-backend/src/router.ts` (one more query
  parameter) and `BoardsService.listItems` (one `whereExists` over
  `item_assignees`). No schema change, no migration.
- **No new dependency, no config, no change to how assignees are stored
  or edited.**

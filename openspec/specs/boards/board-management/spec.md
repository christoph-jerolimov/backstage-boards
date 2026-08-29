# boards/board-management Specification

## Purpose
Lets users create, discover, configure, and delete shareable boards with per-board configurable columns, favorites, and optional assignment to a catalog entity.

## Requirements

### Requirement: Create a board
The system SHALL allow an authenticated user to create a board with a name. When the permission framework is in use, creating a board SHALL additionally require an ALLOW decision for the `boards.new.create` permission; a denied user's create request SHALL be rejected with a permission error and the create affordance SHALL NOT be offered in the UI. The creating user SHALL automatically receive the `admin` permission level on the board. A new board SHALL start with a default set of columns that the creator can immediately change.

#### Scenario: User creates a board
- **WHEN** an authenticated user creates a board named "Team Alpha"
- **THEN** the board is persisted with the given name, the user is recorded as its creator with `admin` access, and the board appears in the user's board list

#### Scenario: Board creation requires a name
- **WHEN** a user attempts to create a board with an empty or whitespace-only name
- **THEN** the request is rejected with a validation error and no board is created

#### Scenario: Creation denied by permission policy
- **WHEN** a user whose permission policy denies `boards.new.create` attempts to create a board
- **THEN** the request is rejected with a permission error and no board is created

### Requirement: Configurable columns per board
Each board SHALL have an ordered list of columns configurable from the UI by users with `admin` or `write` access. A column represents an item status; there SHALL be no built-in statuses (including no built-in "done" status) — all statuses come from the board's columns. Columns SHALL be creatable, renamable, reorderable, and deletable inline in the board view.

On a board that already has columns, creation SHALL be offered from each column's menu as "Insert column before" and "Insert column after", which place the new column immediately before or after the column whose menu was used. On a board with no columns, creation SHALL be offered as a standalone affordance in the empty board area. Both entry points SHALL take the new column's title inline in the board view, and SHALL create nothing if the user cancels or supplies an empty title.

#### Scenario: Add a column
- **WHEN** a user with write access adds a column named "In Review" to a board
- **THEN** the column appears at the chosen position in the board view and becomes a selectable status for items on that board

#### Scenario: Insert a column after another
- **WHEN** a user with write access chooses "Insert column after" on the "Todo" column of a board whose columns are "Todo" and "Done", and confirms the title "In Review"
- **THEN** the board's columns are "Todo", "In Review", "Done" in that order, and the new column is never shown at the end of the board on its way there

#### Scenario: Insert a column before the first one
- **WHEN** a user with write access chooses "Insert column before" on the leftmost column and confirms a title
- **THEN** the new column becomes the leftmost column of the board

#### Scenario: Cancelled insert creates nothing
- **WHEN** a user with write access opens an insert affordance and then cancels it or confirms an empty title
- **THEN** the board's columns are unchanged

#### Scenario: Read-only user has no insert entries
- **WHEN** a user with only read access opens a column's menu
- **THEN** no insert entries are offered and the column set cannot be changed

#### Scenario: Rename a column
- **WHEN** a user with write access renames a column
- **THEN** items in that column keep their association with the renamed column and display the new status name

#### Scenario: Delete a non-empty column
- **WHEN** a user with write access deletes a column that still contains items
- **THEN** the system requires the user to choose a target column for those items (or blocks deletion until the column is empty) so that no item is left without a status

### Requirement: Board list view
The system SHALL provide a list view showing the user's favorited boards and all boards the user can access (via direct permission, group permission, or public visibility). The list SHALL allow toggling between "Favorites" and "All" and show at least the board name, the catalog entities it references, and the user's access level. Each list SHALL be rendered as a table whose last column is an actions column holding a menu button; activating a row SHALL open the board. The actions menu SHALL also open, anchored at the pointer, when the user right-clicks the row.

Both tabs SHALL request their boards one page at a time and SHALL render a pagination footer below the table showing the range of rows on screen, the total number of matching boards, previous/next controls disabled at the bounds, and a page-size choice. Both tabs SHALL offer the board filter bar. The "All" tab's label SHALL count all boards the user can access and the "Favorites" tab's label SHALL count all boards the user has favorited, each independent of the filters currently applied.

#### Scenario: List accessible boards
- **WHEN** a user opens the boards list
- **THEN** they see every board they can read — owned, directly shared, shared via one of their groups, or public — and no board they cannot read

#### Scenario: Favorite a board
- **WHEN** a user marks a board as favorite
- **THEN** the board appears in their "Favorites" list on subsequent visits; favorites are per-user and do not affect other users

#### Scenario: Row actions menu
- **WHEN** a user activates the menu button in a board row's actions column
- **THEN** a menu offers opening the board and toggling its favorite state, and choosing an entry acts on that row's board

#### Scenario: Right-click opens the same menu
- **WHEN** a user right-clicks a board row
- **THEN** the browser context menu is suppressed and the row's actions menu opens at the pointer position

#### Scenario: Paging through the list
- **WHEN** a user with more accessible boards than one page holds presses "next" in the pagination footer
- **THEN** the table shows the following page of boards in the same order, the range summary advances, and no board is shown twice or skipped

#### Scenario: Board list stays fresh after a change
- **WHEN** a user toggles a board's favorite state, or a board change arrives on the `boards` signal channel, while a paginated tab is open
- **THEN** the currently shown page is refetched and reflects the change

#### Scenario: Tab labels unaffected by filters
- **WHEN** a user has filters active that match only some boards
- **THEN** the "All" tab label still counts every board the user can access and the "Favorites" tab label still counts every board the user has favorited

### Requirement: Update and delete boards
Users with `admin` access SHALL be able to rename a board and delete it. Deleting a board SHALL delete its columns, items, comments, change history, permissions, favorites, and watches. Users with `write` or `read` access SHALL NOT be able to rename or delete the board.

#### Scenario: Rename a board
- **WHEN** a board admin renames the board inline
- **THEN** the new name is persisted and shown to all users with access

#### Scenario: Delete a board
- **WHEN** a board admin deletes the board and confirms the destructive action
- **THEN** the board and all its data are removed and it disappears from all users' lists

#### Scenario: Non-admin cannot delete
- **WHEN** a user with `write` access attempts to delete the board
- **THEN** the request is rejected with a permission error and the board is unchanged

### Requirement: List boards by assigned entity
The board listing API SHALL accept an entity-ref filter returning only boards assigned to that catalog entity, still restricted to boards the caller can access. The catalog entity tab SHALL use this filter instead of client-side filtering.

#### Scenario: Filtered listing
- **WHEN** the board list is requested with `entityRef=system:default/payments`
- **THEN** only accessible boards assigned to that entity are returned

#### Scenario: Access still enforced
- **WHEN** a board assigned to the entity is not accessible to the caller
- **THEN** it is absent from the filtered listing

### Requirement: Column colors
A column SHALL have an optional display color chosen from a fixed palette by users with write access, from the column's menu. The color SHALL appear as a dot in the kanban column header, as the color of the status badge in the table view, and as the status badge shown in the item detail view. Columns without a color SHALL render with a neutral default.

#### Scenario: Set a column color
- **WHEN** a user with write access picks "green" for the "Done" column
- **THEN** the column header shows a green dot and items of that column show a green status badge in the table and in the detail view

#### Scenario: Neutral default
- **WHEN** a column has no color set
- **THEN** status indicators for that column render in a neutral color

### Requirement: Duplicate a board
Users with read access SHALL be able to duplicate a board from its more menu, choosing a name and which parts of the source board to copy: its columns (including colors), its items, its entity references, and/or its share settings. Because duplicating creates a new board, it SHALL be subject to the same `boards.new.create` permission decision as creating a board, and the duplicate affordance SHALL NOT be offered to denied users. The duplicating user SHALL become admin of the copy. Share settings SHALL only be copyable by admins of the source board; the copy otherwise starts private with only the duplicator's admin grant.

#### Scenario: Duplicate with columns
- **WHEN** a user duplicates a board choosing to copy columns
- **THEN** a new board is created with the same column titles, order, and colors, no items, and the user as admin

#### Scenario: Duplicate with share settings
- **WHEN** a source-board admin duplicates it choosing to copy share settings
- **THEN** the copy has the same visibility and permission entries plus the duplicator as admin

#### Scenario: Non-admin cannot copy share settings
- **WHEN** a user without admin access on the source requests share-settings copying
- **THEN** the request is rejected

#### Scenario: Duplicate denied by permission policy
- **WHEN** a user whose permission policy denies `boards.new.create` attempts to duplicate a board
- **THEN** the request is rejected with a permission error and no board is created

### Requirement: Board archival, grace window, and purge
Deleting a board SHALL archive it rather than remove it. Archived boards SHALL not appear in any listing (board list, favorites, entity assignments) and SHALL only be reachable via their direct link, read-only. The board page SHALL show an alert stating when the board will be permanently deleted, offering admins an "Unarchive" action that restores the board and a "Delete now" action that removes it immediately. A scheduled backend task SHALL permanently delete boards archived more than 30 days ago, including all their data.

#### Scenario: Delete archives the board
- **WHEN** a board admin confirms deletion
- **THEN** the board is archived, disappears from all listings, and remains reachable via its link

#### Scenario: Alert with deletion date and delete-now
- **WHEN** an admin opens an archived board via its link
- **THEN** an alert explains that the board is read-only and names the permanent-deletion date, with a "Delete now" action that hard-deletes the board after confirmation

#### Scenario: Unarchive restores the board
- **WHEN** an admin presses "Unarchive" on an archived board
- **THEN** the board returns to listings and becomes writable again; unarchiving a board that is not archived is rejected

#### Scenario: Purge after 30 days
- **WHEN** the purge task runs and a board has been archived for more than 30 days
- **THEN** the board and all its data are permanently removed, while more recently archived boards remain

### Requirement: Multiple entity references per board

A board SHALL reference zero or more catalog entities (for example a
component and the owning team). Admins SHALL manage the list through a
board settings dialog (add via catalog-backed picker, remove per entry)
and through the API, where an update replaces the whole list. The board
header SHALL show the referenced entities as catalog links. Filtering
boards by an entity SHALL match every board whose list contains that
entity. Invalid entity refs SHALL be rejected.

#### Scenario: Reference a component and a team

- **WHEN** an admin adds `component:default/service-a` and
  `group:default/team-a` to a board's settings
- **THEN** the board lists both entities and appears in entity-filtered
  listings for either of them

#### Scenario: Remove a reference

- **WHEN** an admin removes an entity from the board settings
- **THEN** the board no longer appears in that entity's filtered listing

#### Scenario: Existing assignment migrated

- **WHEN** the migration runs on a board with a legacy single entity
  assignment
- **THEN** the board's entity list contains that entity

### Requirement: Duplicate copies items and entity references on request

Board duplication SHALL optionally copy the source board's non-archived
items — titles, positions, descriptions, due dates, assignees, and
tags — into the corresponding copied columns. Copying items SHALL
require copying columns; a request to copy items without columns SHALL
be rejected. Comments, item history, watches, and external-manager
flags SHALL NOT be copied. Duplication SHALL also optionally copy the
board's entity reference list.

#### Scenario: Items copied with columns

- **WHEN** a board is duplicated with copy columns and copy items
- **THEN** each new column contains copies of the source column's
  active items with their fields and associations, and the copies have
  no comments or history beyond their creation

#### Scenario: Items require columns

- **WHEN** a duplicate request asks for items without columns
- **THEN** the request fails with an input error

#### Scenario: Entity references copied

- **WHEN** a board referencing two entities is duplicated with copy
  entity references
- **THEN** the copy references the same two entities

### Requirement: Per-status item counts in board listings

The board listing SHALL support an opt-in mode that returns, for each
listed board, that board's columns together with the number of
non-archived items in each column. The counts SHALL be scoped exactly
like the listing itself: a board the caller cannot read contributes no
counts, and a column with no items is reported with a count of zero
rather than omitted. Requesting counts SHALL NOT change which boards the
listing returns.

When the mode is not requested, the listing SHALL be unchanged and SHALL
carry no counts, so existing callers pay nothing for the feature.

#### Scenario: Counts requested

- **WHEN** a user lists boards with counts requested, and one of their
  boards has three items in "Todo", one in "In Progress", and none in
  "Done"
- **THEN** that board's entry carries its three columns with counts 3, 1,
  and 0 respectively

#### Scenario: Archived items excluded from counts

- **WHEN** counts are requested and one item on a listed board is archived
- **THEN** the archived item is not included in its column's count

#### Scenario: Counts do not widen access

- **WHEN** a user lists boards with counts requested and a private board
  they cannot read exists
- **THEN** neither that board nor any count for it is returned

#### Scenario: Counts not requested

- **WHEN** a caller lists boards without requesting counts
- **THEN** the entries carry no counts and are otherwise identical to a
  listing made without the mode available

### Requirement: Filter the board list by search, entity, and creator

Both the "All" and the "Favorites" tab of the board list SHALL offer a
filter bar with a "Search" text field matching the board name
case-insensitively, an entity dropdown, and a "Created by" dropdown.
Each dropdown SHALL select one option at a time and SHALL offer an entry
that selects none of them ("All entities" / "Anyone"). The filters SHALL
combine with AND: a board is listed only if it satisfies every active
filter, and on the "Favorites" tab additionally only if the user has
favorited it. An empty or whitespace-only search SHALL NOT filter
anything.

Each tab SHALL own its filter state independently: a filter applied on
one tab SHALL NOT affect the other tab's listing, and switching tabs
SHALL NOT clear either tab's filters.

The dropdown options SHALL be labelled the way the item filter bar
labels its assignees — by the display name resolved from the catalog,
falling back to the ref's own name until the catalog answers or when it
does not resolve, with the ref itself reachable from the option — and
SHALL be sorted by that label.

The filter bar SHALL offer a "Clear filters" action whenever at least
one filter is active, and SHALL report how many boards match out of the
tab's unfiltered total — all readable boards on the "All" tab, all
favorited boards on the "Favorites" tab. Changing any filter SHALL
return the listing to its first page.

Filtering SHALL be applied by the listing API, not by the browser over
an already-fetched page, so that filtering and pagination agree: the
reported total SHALL count matching boards and every page but the last
SHALL be full.

#### Scenario: Search narrows the list

- **WHEN** a user types "pay" into the search field
- **THEN** the list shows only boards whose name contains "pay",
  case-insensitively, the match count reflects that number, and the
  listing is back on its first page

#### Scenario: Filters combine

- **WHEN** a user selects the entity `system:default/payments` and the
  creator `user:default/anna`
- **THEN** only boards that reference that entity **and** were created by
  that user are listed

#### Scenario: Favorites tab filters within favorites

- **WHEN** a user with several favorited boards types a search on the
  "Favorites" tab
- **THEN** the list shows only favorited boards whose name matches, the
  match count reports how many of their favorites match, and boards the
  user has not favorited stay absent however well they match

#### Scenario: Options read as names

- **WHEN** a user opens the "Created by" dropdown on boards created by a
  catalog user with a profile display name
- **THEN** the option reads as that display name rather than as the raw
  entity ref, and the ref stays reachable from the option

#### Scenario: Selecting replaces the previous selection

- **WHEN** a user picks one entity and then picks another
- **THEN** the second replaces the first rather than widening the filter

#### Scenario: Clearing filters restores the list

- **WHEN** a user presses "Clear filters"
- **THEN** the search field is empty, both dropdowns return to their
  "all" selection, and the unfiltered first page is shown

#### Scenario: No board matches

- **WHEN** the active filters match none of the user's boards
- **THEN** the tab explains that no boards match the filters and offers
  to clear them, rather than showing the "no boards yet, create one"
  message used when the user has no boards at all

#### Scenario: No favorite matches

- **WHEN** a user with favorited boards has filters active on the
  "Favorites" tab that match none of them
- **THEN** the tab explains that no favorite boards match the filters,
  rather than showing the "no favorites yet" message used when the user
  has no favorites at all

#### Scenario: Favorites tab is unfiltered

- **WHEN** a user has filters active on the "All" tab and switches to
  "Favorites" without setting any filter there
- **THEN** the favorites listing is unaffected by the "All" tab's
  filters

#### Scenario: Tabs filter independently

- **WHEN** a user filters the "Favorites" tab, switches to the "All"
  tab, and switches back
- **THEN** the "All" tab's listing is unaffected by the favorites
  filters, and the "Favorites" tab still shows its filters as they were

### Requirement: Board filter options are scoped to the caller's boards

The system SHALL provide a filter-options endpoint returning, for the
calling principal, the distinct catalog entity refs referenced by boards
the caller can read, the distinct creators of those boards, the number
of those boards, and the number of those boards the caller has
favorited. The dropdowns of the board filter bar SHALL be populated from
this endpoint and from no other source.

The options SHALL be derived from the caller's readable, non-archived
boards only. The endpoint SHALL NOT return catalog users, entities, or
creators that are not attached to a board the caller can read, and it
SHALL therefore never disclose who created a board the caller cannot
see, nor that such a board exists.

The options SHALL be computed over the caller's readable boards
regardless of which filters the caller currently has applied, so that a
selected filter can always be changed or widened.

#### Scenario: Options come from readable boards

- **WHEN** a user can read two boards, one referencing
  `component:default/service-a` created by `user:default/anna` and one
  referencing `system:default/payments` created by the user themself
- **THEN** the entity dropdown offers exactly those two entity refs and
  the creator dropdown exactly those two users

#### Scenario: Inaccessible boards contribute nothing

- **WHEN** a private board the caller cannot read references
  `component:default/secret` and was created by `user:default/mallory`
- **THEN** neither that entity ref nor that user appears in the caller's
  filter options

#### Scenario: Catalog users are not listed

- **WHEN** the catalog contains many users who have never created a
  board the caller can read
- **THEN** none of them appear in the "Created by" dropdown

#### Scenario: Options do not shrink with a selection

- **WHEN** a user selects one entity in the entity dropdown
- **THEN** the creator dropdown and the entity dropdown still offer every
  option derived from the caller's readable boards

#### Scenario: Archived boards excluded

- **WHEN** a board the caller could read is archived
- **THEN** its entity refs and its creator no longer appear in the filter
  options unless another readable board carries them

#### Scenario: Favorites count is per-caller

- **WHEN** a user has favorited two of the boards they can read and
  another user has favorited none
- **THEN** the first user's filter options report a favorites count of
  two and the second user's report zero, counting only readable,
  non-archived boards

### Requirement: Paginated board listing

The board listing API SHALL accept `limit` and `offset` parameters and
SHALL return, alongside the page of boards, the total number of boards
matching the request. The total SHALL count matches rather than the rows
of the returned page. The listing SHALL have a stable total order so that
successive pages neither repeat nor skip a board.

`limit` SHALL be bounded to a maximum page size, and a non-numeric or
negative value SHALL be rejected with a validation error. When no `limit`
is given the listing SHALL return every matching board, so that callers
which do not paginate — the home page widgets, the catalog entity tab,
and the actions — are unaffected.

Access filtering SHALL be applied before the page is cut, so that a page
never contains fewer boards than requested merely because boards the
caller cannot read were removed from it after the fact, and so that the
total never counts a board the caller cannot read.

#### Scenario: Second page of a listing

- **WHEN** a caller lists boards with `limit=2&offset=2` and can read
  five boards
- **THEN** the third and fourth boards in the listing order are returned,
  together with a total of five

#### Scenario: Access is applied before paging

- **WHEN** boards the caller cannot read are interleaved with boards they
  can, and the caller requests a page of 10
- **THEN** the response contains 10 readable boards (if that many exist)
  and the total counts only readable boards

#### Scenario: Unpaged listing unchanged

- **WHEN** a caller lists boards without `limit`
- **THEN** every matching board is returned in one response, exactly as
  before pagination existed

#### Scenario: Invalid paging parameters

- **WHEN** a caller passes a non-numeric or negative `limit` or `offset`
- **THEN** the request is rejected with a validation error rather than
  silently ignoring the parameter

#### Scenario: Page size is bounded

- **WHEN** a caller requests a page larger than the maximum page size
- **THEN** the request is rejected or clamped to the maximum, and never
  returns an unbounded response

### Requirement: Board visibility is evaluated by the listing query

The board listing SHALL determine which boards a principal may see as
part of its database query rather than by filtering a fully loaded
listing afterwards, so that filtering, ordering, paging, totals, and
filter options are all computed over the correct set.

The set of boards the listing query selects SHALL be exactly the set for
which the effective-level computation grants any level: public boards for
everyone, logged-in boards for authenticated users, boards granted
directly to the user or to one of their groups, and every board for
service principals. The effective access level reported for each listed
board SHALL continue to come from that same effective-level computation.

#### Scenario: Query selection matches the permission rules

- **WHEN** boards exist for every combination of visibility and grant,
  and each of a user, a service, and an anonymous principal lists them
- **THEN** the boards returned are exactly those for which the effective
  level computation yields a level, for each principal

#### Scenario: Reported level is unchanged

- **WHEN** a user lists boards on which they hold a group grant of
  `write` and a public read visibility
- **THEN** the board is listed with access `write`, as before

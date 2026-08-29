# Board Management — Delta

## MODIFIED Requirements

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

# Board Management

## MODIFIED Requirements

### Requirement: Board list view
The system SHALL provide a list view showing the user's favorited boards and all boards the user can access (via direct permission, group permission, or public visibility). The list SHALL allow toggling between "Favorites" and "All" and show at least the board name, the catalog entities it references, and the user's access level. Each list SHALL be rendered as a table whose last column is an actions column holding a menu button; activating a row SHALL open the board. The actions menu SHALL also open, anchored at the pointer, when the user right-clicks the row.

Both tabs SHALL request their boards one page at a time and SHALL render a pagination footer below the table showing the range of rows on screen, the total number of matching boards, previous/next controls disabled at the bounds, and a page-size choice. The "All" tab SHALL additionally offer the board filter bar; the "Favorites" tab SHALL NOT. The "All" tab's label SHALL count all boards the user can access, independent of the filters currently applied.

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

## ADDED Requirements

### Requirement: Filter the board list by search, entity, and creator

The "All" tab of the board list SHALL offer a filter bar with a
"Search" text field matching the board name case-insensitively, an
entity dropdown, and a "Created by" dropdown. Each dropdown SHALL select
one option at a time and SHALL offer an entry that selects none of them
("All entities" / "Anyone"). The filters SHALL combine with AND: a board
is listed only if it satisfies every active filter. An empty or
whitespace-only search SHALL NOT filter anything.

The dropdown options SHALL be labelled the way the item filter bar
labels its assignees — by the display name resolved from the catalog,
falling back to the ref's own name until the catalog answers or when it
does not resolve, with the ref itself reachable from the option — and
SHALL be sorted by that label.

The filter bar SHALL offer a "Clear filters" action whenever at least
one filter is active, and SHALL report how many boards match. Changing
any filter SHALL return the listing to its first page.

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

#### Scenario: Favorites tab is unfiltered

- **WHEN** a user has filters active on the "All" tab and switches to
  "Favorites"
- **THEN** the favorites listing is unaffected by those filters

### Requirement: Board filter options are scoped to the caller's boards

The system SHALL provide a filter-options endpoint returning, for the
calling principal, the distinct catalog entity refs referenced by boards
the caller can read, the distinct creators of those boards, and the
number of those boards. The dropdowns of the board filter bar SHALL be
populated from this endpoint and from no other source.

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

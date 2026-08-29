# boards/homepage-widgets Specification

## Purpose
Defines the cards the boards plugin contributes to the Backstage home page — what each shows, how a user configures a placed card, and how the cards behave while loading, when empty, and on failure.

## Requirements

### Requirement: Boards plugin contributes home page widgets

The boards frontend plugin SHALL contribute home page widgets that a user
can add to their home page from the home page's widget catalog, without
any additional wiring in the app. Each widget SHALL carry a title and a
description so it is identifiable in that catalog, and SHALL declare
default, minimum, and maximum grid dimensions so it is legible at its
default size.

Each widget SHALL be configurable per placed card: two users, or the same
user with two copies of a widget on their home page, SHALL be able to
hold different settings, and a card's settings SHALL survive a page
reload.

#### Scenario: Widgets are offered in the widget catalog

- **WHEN** a user opens the home page's "Add widget" dialog in an app
  that installs the boards plugin
- **THEN** an "Assigned items" widget and a "Boards" widget are offered,
  each with its description

#### Scenario: Settings are per card and persist

- **WHEN** a user changes a placed card's settings and reloads the home
  page
- **THEN** the card still renders with the settings the user chose, and
  another card of the same widget on the same home page keeps its own
  settings

#### Scenario: Settings default when never configured

- **WHEN** a widget is added to the home page and its settings are never
  opened
- **THEN** the card renders with its documented defaults rather than an
  error or an empty card

### Requirement: Assigned items widget

The plugin SHALL provide an "Assigned items" widget listing the items
assigned to the current user — directly or through one of their groups —
across every non-archived board the user can read. It SHALL show for each
item at least the item title, its status, and its due date when set.
Archived items and items on boards the user cannot read SHALL NOT appear.

Activating an item SHALL open that item's detail drawer in place on the
homepage, without navigating away. The drawer SHALL offer the same detail
view as on the item's board — including editing when the user has write
access to that board, and read-only otherwise. Changes made in the drawer
SHALL be reflected in the card, including removing an item that is no
longer assigned to the user. Closing the drawer SHALL leave the user on
the homepage. The item's board SHALL remain reachable from the card.

#### Scenario: Assigned items are listed

- **WHEN** a user with items assigned on two readable boards views the
  widget
- **THEN** the items from both boards are listed with their title,
  status, and due date

#### Scenario: Opening an item from the card

- **WHEN** the user activates one of the listed items
- **THEN** the item's detail drawer opens on the homepage, without
  navigating to the board

#### Scenario: Editing an item from the homepage drawer

- **WHEN** the user changes an item's status or due date in a drawer
  opened from the card, for an item on a board they can write to
- **THEN** the change is saved to the item's board and the card row
  reflects it after the drawer closes

#### Scenario: Read-only board opens a read-only drawer

- **WHEN** the user activates an item that lives on a board they can
  only read
- **THEN** the drawer opens showing the item's details without any
  editing controls

#### Scenario: Nothing assigned

- **WHEN** the user has no assigned items
- **THEN** the card states that nothing is assigned to them instead of
  rendering an empty list

### Requirement: Assigned items widget scope setting

The "Assigned items" widget SHALL offer a scope setting with two values:
**all** assigned items, and **due** items only. In **due** mode the card
SHALL show only items whose due date is today or in the past, evaluated
against the viewer's local calendar date; items without a due date SHALL
NOT appear in that mode. The default SHALL be **all**.

#### Scenario: Due mode hides future and undated items

- **WHEN** the scope is set to due only, and the user is assigned one
  overdue item, one item due today, one item due next week, and one item
  with no due date
- **THEN** the card lists exactly the overdue item and the item due today

#### Scenario: All mode shows everything assigned

- **WHEN** the scope is set to all
- **THEN** items with a future due date and items with no due date are
  listed alongside overdue items

#### Scenario: Due mode with nothing due

- **WHEN** the scope is set to due only and no assigned item is due today
  or overdue
- **THEN** the card states that nothing is due rather than showing the
  general "nothing assigned" message

### Requirement: Assigned items widget grouping setting

The "Assigned items" widget SHALL offer a group-by setting with three
values: **board**, **status**, and **due date**. Each group SHALL be
labelled and SHALL show how many items it contains. Grouping SHALL apply
after the scope filter, so a group only ever counts items the card is
showing. The default SHALL be **board**.

Group order SHALL be stable and meaningful for the chosen mode: by board
and by status alphabetically by label; by due date chronologically with
the most urgent first, and items with no due date last.

#### Scenario: Grouped by board

- **WHEN** the group-by setting is board
- **THEN** items are grouped under their board's name, each group is
  labelled with that name and its item count, and activating the group
  label opens that board

#### Scenario: Grouped by status

- **WHEN** the group-by setting is status
- **THEN** items are grouped under their column title, and items with the
  same status from different boards appear in the same group

#### Scenario: Grouped by due date

- **WHEN** the group-by setting is due date
- **THEN** items are grouped by their due date with the earliest date
  first and items without a due date in a final group

#### Scenario: Grouping respects the scope filter

- **WHEN** the scope is due only and the group-by setting is board
- **THEN** boards whose items are all undated or due in the future do not
  appear as groups

### Requirement: Boards widget

The plugin SHALL provide a "Boards" widget listing the boards the current
user can reach, showing each board's name. Archived boards and boards the
user cannot read SHALL NOT appear. Activating a board SHALL navigate to
that board.

#### Scenario: Boards are listed

- **WHEN** a user who can read three boards views the widget
- **THEN** the three boards are listed by name and no board the user
  cannot read is shown

#### Scenario: Opening a board from the card

- **WHEN** the user activates one of the listed boards
- **THEN** the app navigates to that board

#### Scenario: No boards to show

- **WHEN** no board matches the card's scope
- **THEN** the card states that there is nothing to show and points the
  user at the boards page

### Requirement: Boards widget scope setting

The "Boards" widget SHALL offer a scope setting with two values:
**favorites** — only boards the user has favorited — and **all** boards
the user can access. Favorites are per-user, so the same card shows
different boards to different users. The default SHALL be **favorites**.

#### Scenario: Favorites scope

- **WHEN** the scope is favorites and the user has favorited two of the
  five boards they can read
- **THEN** the card lists exactly those two boards

#### Scenario: All scope

- **WHEN** the scope is all
- **THEN** the card lists every board the user can read, favorited or not

#### Scenario: Favorites scope with no favorites

- **WHEN** the scope is favorites and the user has favorited no board
- **THEN** the card says so and points the user at the boards page rather
  than silently falling back to all boards

### Requirement: Boards widget item count setting

The "Boards" widget SHALL offer a setting that turns per-status item
counts on or off. When on, each listed board SHALL show the number of
non-archived items in each of its columns, labelled with the column title
and carrying that column's color when one is set. A column with no items
SHALL still be shown with a count of zero, so the board's shape is
readable. When off, no counts SHALL be requested or shown. The default
SHALL be off.

#### Scenario: Counts shown per status

- **WHEN** counts are turned on for a board with three items in "Todo",
  one in "In Progress", and none in "Done"
- **THEN** the board's row shows Todo 3, In Progress 1, and Done 0

#### Scenario: Archived items are not counted

- **WHEN** counts are turned on and one of a column's items is archived
- **THEN** that column's count excludes the archived item

#### Scenario: Counts off

- **WHEN** counts are turned off
- **THEN** the board rows show no counts

### Requirement: Widget loading and failure states

Each widget SHALL show a loading indication while its data is in flight
and SHALL report a failure in place, inside the card, without breaking the
home page or any other widget on it. A widget SHALL refresh its data when
a board change is signalled, so a card left open does not go stale.

#### Scenario: A failing widget does not break the home page

- **WHEN** the request behind one widget fails
- **THEN** that card shows an error message and the rest of the home page
  keeps rendering normally

#### Scenario: Refresh on board changes

- **WHEN** a board the card is showing changes while the home page is open
- **THEN** the card's content updates without the user reloading the page

### Requirement: Widgets require the use permission

When the permission framework is in use, a placed boards home page widget SHALL render nothing (or an unobtrusive empty state) for a user who is denied the `boards.use` permission, and SHALL NOT issue boards API calls on that user's behalf.

#### Scenario: Denied user sees no widget content

- **WHEN** a user whose permission policy denies `boards.use` opens a home page containing a boards widget
- **THEN** the widget shows no board data and triggers no failing boards API requests

#### Scenario: Allowed user is unaffected

- **WHEN** a user granted `boards.use` opens a home page containing a boards widget
- **THEN** the widget loads and behaves as before

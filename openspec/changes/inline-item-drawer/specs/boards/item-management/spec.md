# Item Management

## ADDED Requirements

### Requirement: Item details openable away from its board

The item details drawer SHALL be openable over any page that lists items,
not only over the board the item belongs to. Opened this way it SHALL
offer the same content and the same edit capabilities as on the board —
title, status, due date, assignees, description, tags, watching, deleting
and the activity timeline — and SHALL derive the user's write access from
that item's board, so a read-only board stays read-only wherever its item
is opened.

While the item's board is being loaded the drawer SHALL show that it is
loading rather than nothing, and SHALL report in place, without closing
itself, if the board cannot be loaded or the item is no longer on it.
Every one of these states SHALL be dismissible by the same means as the
drawer itself.

When the drawer is opened away from its board it SHALL name that board
and SHALL offer to open it, so the board remains one activation away.
When it is opened on the board itself no such affordance SHALL be shown.

Editing an item from the drawer SHALL refresh the listing the drawer was
opened from, not only the board's own views.

#### Scenario: Editing without leaving the list

- **WHEN** a user opens an item's details from a list outside its board
  and changes the item's status
- **THEN** the change is saved, the user is still on the page they
  started from, and the listing behind the drawer reflects the new status

#### Scenario: Read-only board honored away from the board

- **WHEN** a user with only read access to a board opens one of its items
  from a list outside that board
- **THEN** the details are shown and no field offers to be edited, exactly
  as on the board itself

#### Scenario: Board still reachable from the drawer

- **WHEN** a user opens an item's details away from its board
- **THEN** the drawer names the item's board and activating that name
  opens the board

#### Scenario: Item no longer available

- **WHEN** a user activates an item that has since been deleted or
  archived
- **THEN** the drawer opens and states that the item is no longer on the
  board, rather than showing an empty drawer or silently doing nothing

#### Scenario: Loading the board

- **WHEN** the item's board has not been loaded yet
- **THEN** the drawer indicates that it is loading and can still be closed

## MODIFIED Requirements

### Requirement: My items sub-page

The frontend SHALL offer a "My items" sub-page under the boards page that
groups the user's items by board, shows status, due date (with the
standard urgency colors), and tags, links each board heading to the
board, and opens an item's details in place — over the listing, without
leaving the page — when clicked. Each board group SHALL be rendered as a
table whose last column is an actions column holding a menu button, and
that menu SHALL also open at the pointer on right-click. That menu SHALL
offer both opening the item's details in place and navigating to its
board. The boards page SHALL reach the same listing through its "My
items" tab; a separate button link to the sub-page is not required.

The item whose details are open SHALL be reflected in the page address by
its board and item, so the open drawer can be linked to and survives a
reload, and closing it SHALL remove them again. Arriving at the boards
page with those parameters SHALL select the "My items" tab, so the drawer
opens over the listing it belongs to.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** that item's details open over the listing and the user stays
  on the my-items page

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details and to open its board

#### Scenario: Opening the board from the row menu

- **WHEN** the user chooses to open the board from a row's menu
- **THEN** the app navigates to that board, as before

#### Scenario: Deep link to an open item

- **WHEN** a user loads the my-items address carrying a board and item
- **THEN** the listing renders with that item's details already open

#### Scenario: Closing the drawer restores the plain listing

- **WHEN** the user closes an open item's details
- **THEN** the drawer disappears, the address no longer names an item,
  and the listing is unchanged underneath

#### Scenario: Tab selected for a deep link

- **WHEN** a user loads the boards page address carrying a board and item
- **THEN** the "My items" tab is the selected tab and the item's details
  are open over it

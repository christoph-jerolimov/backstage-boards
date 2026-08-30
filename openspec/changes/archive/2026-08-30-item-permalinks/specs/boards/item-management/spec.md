## ADDED Requirements

### Requirement: Item permalinks
Every item SHALL be addressable by a permalink: the item's board page
URL carrying the item's id in the `item` query parameter, which opens
the board with the item's details drawer shown. Item menus — on cards,
table rows, in the details drawer, and on the my-items page — SHALL
offer a "Copy link" entry that places this permalink, as an absolute
URL, on the clipboard, available to readers as well as writers. The
menu SHALL give brief feedback that the link was copied. A permalink to
an archived or deleted item SHALL open the board without a drawer
rather than failing.

#### Scenario: Copy and open a permalink
- **WHEN** a user chooses "Copy link" on an item and the copied URL is
  opened in a new tab
- **THEN** the item's board opens with that item's details drawer shown

#### Scenario: Readers can copy links
- **WHEN** a user with read-only access opens an item's menu
- **THEN** the "Copy link" entry is offered and works

#### Scenario: Stale permalink degrades gracefully
- **WHEN** a permalink to a since-archived item is opened
- **THEN** the board renders normally without an open drawer

# boards/keyboard-navigation Specification

## Purpose
Defines keyboard focus, arrow-key navigation, and action shortcuts on
board cards and table rows, so items can be browsed, selected, moved,
and edited without a pointer.

## Requirements

### Requirement: Board card focus and arrow navigation
Board cards SHALL be reachable and navigable by keyboard. The board
SHALL expose a single tab stop for its cards (roving focus): tabbing
into the board focuses one card, and the arrow keys move focus between
cards while Tab leaves the card grid. The focused card SHALL carry a
clearly visible focus indicator distinct from the selected-for-bulk
marking. Arrow Up/Down SHALL move focus to the previous/next card in
the column's visible order (spanning group sections when the board is
grouped); at the first/last card of a column, focus SHALL stay put.
Arrow Left/Right SHALL move focus into the neighbouring column —
skipping empty columns — to the card at the same visible position, or
the last card when that column has fewer cards; when no column in that
direction has cards, focus SHALL stay put.

#### Scenario: Arrow down moves to the next card
- **WHEN** a user focuses the first card of the "Todo" column and
  presses Arrow Down
- **THEN** focus moves to the second card of "Todo" and the focus
  indicator moves with it

#### Scenario: Arrow right changes column
- **WHEN** the third card of "Todo" is focused and the user presses
  Arrow Right, and the next non-empty column "Doing" has two cards
- **THEN** focus moves to the last card of "Doing"

#### Scenario: Edges keep focus in place
- **WHEN** the last card of the rightmost non-empty column is focused
  and the user presses Arrow Down or Arrow Right
- **THEN** the same card stays focused

#### Scenario: One tab stop
- **WHEN** a user tabs through the board page
- **THEN** the card grid is entered with a single Tab press onto one
  card, and the next Tab press leaves the card grid rather than
  visiting every card

### Requirement: Table row focus and arrow navigation
Table view rows SHALL be focusable as complete rows with a visible
focus indicator. Arrow Up/Down SHALL move focus to the previous/next
row; when the table is grouped, focus SHALL continue from the last row
of a group to the first row of the next group and vice versa. Arrow
Left/Right SHALL NOT move focus between items in the table view. Row
focus alone SHALL NOT open the item drawer.

#### Scenario: Arrow down crosses a group boundary
- **WHEN** the table is grouped by assignee and the last row of the
  first group is focused and the user presses Arrow Down
- **THEN** focus moves to the first row of the next group

#### Scenario: Left and right do not navigate items
- **WHEN** a table row is focused and the user presses Arrow Left or
  Arrow Right
- **THEN** the focused row does not change

### Requirement: Move the focused item with Ctrl+Arrow
For a user with write access, pressing Ctrl+Right / Ctrl+Left while an
item (board card or table row) is focused SHALL move that item one
column to the right / left in the board's column order — in the table
view this means the item's status changes to the neighbouring column.
The moved item SHALL keep the keyboard focus. When there is no column
in that direction, the shortcut SHALL do nothing. Keyboard moves SHALL
behave like any other move (optimistic update, history entry). On
externally managed items and for read-only users the shortcut SHALL
have no effect.

#### Scenario: Move card one column right
- **WHEN** a writer focuses a card in "Todo" and presses Ctrl+Right
- **THEN** the item moves to the next column, its status updates, and
  the card in its new column keeps the keyboard focus

#### Scenario: Move from a table row
- **WHEN** a writer focuses a table row of an item in "Doing" and
  presses Ctrl+Left
- **THEN** the item's status becomes the previous column and the row
  stays focused

#### Scenario: No column in that direction
- **WHEN** a writer focuses an item in the leftmost column and presses
  Ctrl+Left
- **THEN** nothing changes

### Requirement: Select the focused item with Space
Pressing Space while an item is focused SHALL toggle that item's
bulk-operation selection — the same selection used by the checkboxes
and the bulk-actions bar. Space SHALL NOT scroll the page while an
item is focused. For read-only users and on externally managed items,
Space SHALL NOT change the selection.

#### Scenario: Space selects and deselects
- **WHEN** a writer focuses a card and presses Space twice
- **THEN** the item becomes selected (bulk-actions bar appears, the
  card is visibly marked) and then deselected again

#### Scenario: Space in the table matches the checkbox
- **WHEN** a writer focuses a table row and presses Space
- **THEN** the row's selection checkbox becomes checked, identical to
  clicking it

### Requirement: Focused-item menu shortcuts
While an item is focused, Enter SHALL open the item's actions menu,
positioned at the item. The keys `s`, `c`, and `m` SHALL each open the
move-to-column (status) menu; `a` the assignee menu; `d` the due-date
menu; `p` the priority menu (only on boards that define priorities).
Each opened menu SHALL be operable with the keyboard and closing it
(Escape or choosing an entry) SHALL return focus to the item. For
read-only users and on externally managed items, the mutation menus
SHALL NOT open; Enter SHALL still offer the actions available to them
(such as opening the details).

#### Scenario: Enter opens the item menu
- **WHEN** a writer focuses a card and presses Enter
- **THEN** the item's actions menu opens at the card and can be
  navigated with the arrow keys

#### Scenario: Status menu via s
- **WHEN** a writer focuses a table row and presses `s`
- **THEN** a menu listing the board's columns opens, and choosing one
  with Enter moves the item there and returns focus to the row

#### Scenario: Assignee, due date, and priority menus
- **WHEN** a writer focuses a card and presses `a`, `d`, or `p` (board
  with priorities)
- **THEN** the assignee, due-date, or priority menu opens for that item

#### Scenario: Escape returns to the item
- **WHEN** a menu opened via a shortcut is dismissed with Escape
- **THEN** the item that opened it is focused again

### Requirement: Direct priority shortcuts
On a board that defines priorities, pressing a digit `1`–`9` while an
item is focused SHALL set the item's priority to the priority with
that order index (1 = highest), and `0` SHALL set the priority with
order index 10. When no priority with that order exists, or the board
defines no priorities, the digit SHALL do nothing. Read-only users and
externally managed items are unaffected by digit presses.

#### Scenario: Digit sets the priority
- **WHEN** a writer focuses an item on a board with priorities
  Critical(1), High(2), Medium(3), Low(4) and presses `2`
- **THEN** the item's priority becomes High

#### Scenario: Digit without a matching priority
- **WHEN** the same board is used and the user presses `7`
- **THEN** the item's priority does not change

### Requirement: Archive the focused item with Delete
Pressing Delete while an item is focused SHALL archive the item for
users with write access, identical to the menu's archive/delete
action (the item disappears from the views and can be restored from
the archive). After archiving, keyboard focus SHALL move to a
neighbouring item when one exists. The shortcut SHALL have no effect
for read-only users and on externally managed items.

#### Scenario: Delete archives the focused card
- **WHEN** a writer focuses a card and presses Delete
- **THEN** the item is archived, disappears from the board, and a
  neighbouring card of the same column receives focus

### Requirement: Shortcut scoping
The focused-item shortcuts SHALL fire only while the item itself (card
or row) has the keyboard focus. They SHALL NOT fire while the focus is
in a text input or inline editor, while a menu, drawer, or dialog is
open, or when an additional modifier is held beyond the defined
combinations. Handled keys SHALL not additionally trigger their
default behaviour (no page scroll on Space/arrows, no browser history
navigation on Ctrl+Arrow while an item is focused).

#### Scenario: Typing is never hijacked
- **WHEN** a user types the letter `a` or a digit into an item title
  editor or any text field on the page
- **THEN** no assignee menu opens and no priority changes — the
  character is simply typed

#### Scenario: Shortcuts pause while a menu is open
- **WHEN** an item's menu is open and the user presses `d`
- **THEN** no due-date menu opens for the item; the key goes to the
  menu (e.g. typeahead) as usual

### Requirement: Shortcut help dialog
Pressing `?` on the board page — in the kanban view or the table view,
including the embedded catalog-entity tab — SHALL open a compact dialog
listing the available keyboard shortcuts with their keys and a short
description, grouped into navigation and focused-item actions. The
dialog SHALL close via `Escape` and via its close control. `?` SHALL
NOT open the dialog while the user is typing in a text input or inline
editor, or while a menu, another dialog, or the item drawer is open.
Entries that do not apply SHALL be omitted: the priority picker and
priority digit entries on boards without priorities, and the mutating
actions (move, select, pickers, archive) for users without write
access.

#### Scenario: Open and close the help
- **WHEN** a user presses `?` while viewing a board and then presses
  `Escape`
- **THEN** a dialog listing the keyboard shortcuts opens, and closes
  again

#### Scenario: Works with an item focused
- **WHEN** a board card or table row has the keyboard focus and the
  user presses `?`
- **THEN** the shortcut dialog opens (the key is not treated as an item
  shortcut)

#### Scenario: Typing is never hijacked
- **WHEN** a user types `?` into the item search field or an inline
  title editor
- **THEN** no dialog opens — the character is simply typed

#### Scenario: Irrelevant entries are omitted
- **WHEN** a user opens the shortcut help on a board without
  priorities, or as a read-only visitor
- **THEN** the priority picker and digit entries are missing in the
  first case, and the mutating actions are missing in the second,
  while the navigation entries always remain

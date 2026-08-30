# boards/keyboard-navigation Delta

## ADDED Requirements

### Requirement: Move the focused item with Alt+Arrow
For a user with write access, pressing Alt+Right / Alt+Left while an
item (board card or table row) is focused SHALL move that item one
column to the right / left in the board's column order — in the table
view this means the item's status changes to the neighbouring column.
A target column at its hard WIP limit SHALL NOT be entered. The moved
item SHALL keep the keyboard focus. When there is no column in that
direction, the shortcut SHALL do nothing. Keyboard moves SHALL behave
like any other move (optimistic update, history entry). On externally
managed items and for read-only users the shortcut SHALL have no
effect.

#### Scenario: Move card one column right
- **WHEN** a writer focuses a card in "Todo" and presses Alt+Right
- **THEN** the item moves to the next column, its status updates, and
  the card in its new column keeps the keyboard focus

#### Scenario: Move from a table row
- **WHEN** a writer focuses a table row of an item in "Doing" and
  presses Alt+Left
- **THEN** the item's status becomes the previous column and the row
  stays focused

#### Scenario: No column in that direction
- **WHEN** a writer focuses an item in the leftmost column and presses
  Alt+Left
- **THEN** nothing changes

### Requirement: Reorder the focused card with Alt+Up/Down
For a user with write access, pressing Alt+Up / Alt+Down while a board
card is focused SHALL move that item one place up / down within its
column's position order, persisting the position like a drag would;
the card SHALL keep the keyboard focus. At the first/last position the
shortcut SHALL do nothing. In the table view — whose row order is
determined by sorting and grouping — Alt+Up/Down SHALL NOT reorder and
SHALL NOT trigger any browser default. On externally managed items and
for read-only users the shortcut SHALL have no effect.

#### Scenario: Move a card up
- **WHEN** a writer focuses the second card of a column and presses
  Alt+Up
- **THEN** the card becomes the column's first card, keeps the focus,
  and the new order survives a reload

#### Scenario: Edges do nothing
- **WHEN** a writer focuses the last card of a column and presses
  Alt+Down
- **THEN** the order is unchanged

## MODIFIED Requirements

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
direction has cards, focus SHALL stay put. The keys `j`/`k` SHALL act
as Arrow Down/Up and `h`/`l` as Arrow Left/Right. Home/End SHALL move
focus to the first/last card of the current column.

#### Scenario: Arrow down moves to the next card
- **WHEN** a user focuses the first card of the "Todo" column and
  presses Arrow Down
- **THEN** focus moves to the second card of "Todo" and the focus
  indicator moves with it

#### Scenario: Arrow right changes column
- **WHEN** the third card of "Todo" is focused and the user presses
  Arrow Right, and the next non-empty column "Doing" has two cards
- **THEN** focus moves to the last card of "Doing"

#### Scenario: Vim-style aliases
- **WHEN** a user focuses a card and presses `j`, then `k`, then `l`
- **THEN** focus moves down, back up, and into the next non-empty
  column — exactly as Arrow Down, Arrow Up, and Arrow Right would

#### Scenario: Home and End jump within the column
- **WHEN** a user focuses a middle card of a column with five cards
  and presses End, then Home
- **THEN** focus jumps to the column's last card, then to its first

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
of a group to the first row of the next group and vice versa. The keys
`j`/`k` SHALL act as Arrow Down/Up. Home/End SHALL move focus to the
first/last row across all groups. Arrow Left/Right — and their aliases
`h`/`l` — SHALL NOT move focus between items in the table view. Row
focus alone SHALL NOT open the item drawer.

#### Scenario: Arrow down crosses a group boundary
- **WHEN** the table is grouped by assignee and the last row of the
  first group is focused and the user presses Arrow Down
- **THEN** focus moves to the first row of the next group

#### Scenario: Aliases and Home/End in the table
- **WHEN** a middle row is focused and the user presses `j`, then
  Home, then End
- **THEN** focus moves one row down, then to the very first row, then
  to the very last row

#### Scenario: Left and right do not navigate items
- **WHEN** a table row is focused and the user presses Arrow Left,
  Arrow Right, `h`, or `l`
- **THEN** the focused row does not change

### Requirement: Shortcut scoping
The focused-item shortcuts SHALL fire only while the item itself (card
or row) has the keyboard focus. They SHALL NOT fire while the focus is
in a text input or inline editor, while a menu, drawer, or dialog is
open, or when an additional modifier is held beyond the defined
combinations. Handled keys SHALL not additionally trigger their
default behaviour (no page scroll on Space/arrows, no browser history
navigation on Alt+Arrow while an item is focused).

#### Scenario: Typing is never hijacked
- **WHEN** a user types the letter `a` or a digit into an item title
  editor or any text field on the page
- **THEN** no assignee menu opens and no priority changes — the
  character is simply typed

#### Scenario: Shortcuts pause while a menu is open
- **WHEN** an item's menu is open and the user presses `d`
- **THEN** no due-date menu opens for the item; the key goes to the
  menu (e.g. typeahead) as usual

## REMOVED Requirements

### Requirement: Move the focused item with Ctrl+Arrow
**Reason**: The chord collides with common browser and OS shortcuts;
moving the item is rebound to Alt+Arrow so all Alt+arrow combinations
consistently move the item while plain arrows move the focus.
**Migration**: Use Alt+Right / Alt+Left (see "Move the focused item
with Alt+Arrow"); Ctrl+Arrow is no longer handled.

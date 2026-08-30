## ADDED Requirements

### Requirement: Drawer previous/next navigation
On the board page, the item details drawer SHALL offer previous and
next controls in its header together with a "n of m" position
indicator, walking the active view's visible order over the currently
filtered items — the kanban's columns left-to-right with their card
order, or the table's grouped and sorted row order. The **j** key SHALL
navigate to the next item and **k** to the previous one while the
drawer is open, except while the user is typing in an input, textarea,
or editable area. The previous control SHALL be disabled on the first
item and the next control on the last. Navigating SHALL switch the
drawer to the neighbouring item exactly like opening it, updating the
`item` URL parameter.

#### Scenario: Arrow through the board order
- **WHEN** a user opens the first item of the leftmost kanban column
  and presses the next control twice
- **THEN** the drawer shows the second, then the third item of the
  board's visible order, and the indicator advances from "1 of m" to
  "3 of m"

#### Scenario: j and k walk the list
- **WHEN** the drawer is open and the user presses `j`, then `k`
- **THEN** the drawer shows the next item and then the original item
  again

#### Scenario: Typing never navigates
- **WHEN** the user types `j` into the drawer's comment field
- **THEN** the letter is entered and the drawer stays on the same item

#### Scenario: Ends disable the controls
- **WHEN** the drawer shows the last item of the current order
- **THEN** the next control is disabled while previous still works

#### Scenario: Filters and sorting shape the order
- **WHEN** a tag filter is active and the table view is sorted by a
  column
- **THEN** the drawer walks exactly the rows the table shows, in that
  order

# Design

The card menu's content moves into a shared `ItemMenu` component (a BUI
`Menu` with Open details / Move to column / Due date, type-only import
of `BoardActions`). The card's `MenuTrigger` and a new trailing table
column both use it.

Right-click: cards and rows call `onContextMenu` (preventDefault) and
lift `{item, x, y}` into view-level state. `ItemContextMenu` renders a
controlled `MenuTrigger` whose trigger is an invisible 1×1 fixed-
position button at the pointer coordinates, so the RAC popover anchors
exactly where the user clicked; closing clears the state.

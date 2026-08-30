# Board Drop Indicator and Keyboard Navigation

## Why

Dragging a card on the board gives almost no feedback about where it
will land: the only hint is a thin line on top of the hovered card,
there is no way to see (or aim for) the "end of column" position, and
dropping on a grouped lane can compute the position against the wrong
list. The board is also effectively mouse-only — cards can be opened
with the keyboard, but not navigated, moved, selected, or edited — and
the table's bulk selection cannot be used from the board view at all.

## What Changes

- **Drop indicator on the board view**: while dragging a card, a clear
  insertion indicator (a horizontal line/gap between cards) shows the
  exact position the card will take — including before the first card,
  between any two cards, after the last card, and in an empty column —
  and the drop inserts the card exactly there. Fixes the position
  computation when the lane is grouped (positions were computed against
  the whole lane instead of the visible order).
- **Board view keyboard navigation**: cards become part of a roving
  focus model with a clearly visible focus indicator. Arrow Up/Down
  move focus to the previous/next card in the column, Arrow Left/Right
  move focus to the neighbouring column.
- **Keyboard actions on the focused card** (write access, not
  externally managed):
  - `Ctrl+Right` / `Ctrl+Left` — move the item one column right/left.
  - `Space` — select/deselect the item for bulk operations.
  - `Enter` — open the item's actions menu.
  - `s`, `c`, or `m` — open the move-to-column (status) menu.
  - `a` — open the assignee menu.
  - `d` — open the due-date menu.
  - `p` — open the priority menu.
  - `1`–`9` — set the priority with that order index; `0` sets
    priority 10 (on boards that define priorities).
  - `Delete` — archive the item.
- **Selection and bulk actions shared between views**: the id-based
  selection state and the bulk-actions bar move up out of the table
  view so both views use the same selection. Selected cards are
  visually marked on the board, the existing bulk-actions bar appears
  in both views, and switching views keeps the selection.
- **Table view keyboard navigation**: rows are focusable as whole rows;
  Arrow Up/Down move between rows and jump across group boundaries
  (last row of a group → first row of the next group). `Space` toggles
  row selection, and the same keyboard actions as on board cards work
  on the focused row (including `Ctrl+Left`/`Ctrl+Right` changing the
  status to the previous/next column). Arrow Left/Right do nothing
  view-specific in the table.

## Capabilities

### New Capabilities

- `boards/keyboard-navigation`: keyboard focus, navigation, and
  shortcuts on board cards and table rows — arrow navigation, the
  focused-item action shortcuts, and their interplay with menus,
  editors, and read-only items.

### Modified Capabilities

- `boards/item-management`: the drag-and-drop requirement gains the
  drop-position indicator and exact-position drops (including grouped
  lanes); the table-scoped row-selection and bulk-action requirements
  become view-spanning — selection is shared with the board view, cards
  show their selected state, and the bulk-actions bar appears in both
  views.

## Impact

- `plugins/boards` only — no backend or common changes; moves,
  updates, and archival reuse the existing single-item and bulk
  fan-out APIs (`useBoardActions`), so history entries and optimistic
  updates behave as today.
- Affected components: `BoardView` (drop zones/indicator, card focus
  and shortcuts, selected-card styling), `TableView` (row focus and
  shortcuts, selection lifted out), `BoardPage` (shared selection
  state, bulk-actions bar hosting), `RowMenu`/`ItemMenu` (opening the
  menu and its submenus from the keyboard), plus tests.
- Docs: `docs/features/board.md` and `docs/features/table.md` gain the
  keyboard reference; the board page's claim about a drop indicator
  becomes true.
- Note: `openspec/specs/boards/item-management/spec.md` on `main`
  contained committed merge-conflict markers; this branch fixes them
  (both conflict sides kept) so the delta specs here apply cleanly.

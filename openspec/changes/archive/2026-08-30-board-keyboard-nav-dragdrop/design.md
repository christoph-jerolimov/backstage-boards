# Design — Board Drop Indicator and Keyboard Navigation

## Context

See `proposal.md` for motivation. Relevant current state
(`plugins/boards`, all frontend):

- Drag & drop uses react-aria's low-level `useDrag`/`useDrop` in
  `BoardView.tsx` (`DRAG_TYPE = 'application/x-boards-item'`). Drop
  targets are the card (drop = "before this card", indicated by a 3px
  `boxShadow` line) and the lane background (drop = append, indicated
  by a lane tint). There is no between-cards/end-of-list indicator,
  and `onDropBefore` computes positions against the lane-wide sorted
  array even when the lane renders grouped sections.
- Ranking is fractional: `positionBefore(sorted, index)` in
  `grouping.ts` returns midpoints; the backend appends at
  `max(position) + step` when no position is sent.
- Selection lives only in `TableView` (`useState<ReadonlySet<string>>`
  + `SelectionHandle` interface); `BulkActionsBar` receives
  `selectedItems`, `bulk` (from `useBoardActions`), and `onClear` as
  props. `BoardPage` renders either `BoardView` or `TableView`.
- The item menu stack is shared: `useRowMenu` returns `onContextMenu`,
  `rowActions(item)` (three-dot trigger) and a positioned
  `contextMenu`; `ItemMenu` holds the entries with Move/Due/Priority/
  Assignee submenus. `ItemActions` already offers `moveItem`,
  `setItemDueDate`, `setAssignees`, `setItemPriority`, `deleteItem`,
  `openItem`.
- Keyboard handling today is ad hoc: card `Enter` → open details,
  drawer `Escape` listener, inline-editor Enter/Escape. Menus and
  in-table arrow behaviour come from react-aria via `@backstage/ui`.
- When grouped, the table view renders one `TableRoot` per group, so
  react-aria's built-in grid navigation stops at group boundaries.
- Priorities: `BoardPriority.order` is 1-based and contiguous.

## Goals / Non-Goals

**Goals:**
- Deterministic drop feedback: what the indicator shows is what the
  drop does, in flat and grouped lanes.
- One keyboard model shared by both views, implemented against the
  existing `ItemActions`/`BulkActions` seams — no new mutation paths.
- Selection as page-level state that both views render.

**Non-Goals:**
- No keyboard-driven drag mode (picking up a card and "carrying" it
  with arrows); Ctrl+Arrow moves between columns, reordering within a
  column stays pointer-based (the accessible move-to-column menu
  covers status changes).
- No shortcut-help dialog, no user-configurable keybindings.
- No changes to `MyItemsPage`'s table, the drawer, or backend/common
  packages.
- No selection or shortcuts for read-only users or externally managed
  items beyond what exists today.

## Decisions

### D1: Dedicated gap drop zones instead of smarter card targets

Render an explicit drop zone element in every gap of a lane: before
each card and after the last card (the empty lane keeps the lane-level
`useDrop`, now with a visible indicator). Each gap zone is a small
`useDrop` target that expands/tints while `isDropTarget`, and knows
its insertion index within the visible list it sits in.

- Why not track pointer Y within a card to pick before/after: react-
  aria's `useDrop` doesn't expose pointer coordinates on hover
  (`onDropMove` exists on the drag side only), so a before/after split
  per card would need manual DOM math against the native event —
  fragile with react-aria's synthetic drop events.
- Gap zones also make the "after last card" and grouped cases exact:
  the zone is rendered per group section, so its index is an index
  into that section's visible order.
- The card itself stays a drop target (large hit area) but delegates
  to "insert before me"; its indicator becomes the same visual as the
  gap zone above it so there is one indicator language. Alternative
  considered: remove card targets entirely and rely on gaps only —
  rejected because thin gaps make sloppy drops fail.

### D2: Fix grouped-drop positions via section-scoped context

`onDropBefore`/gap drops compute the target position with
`positionBefore(sectionVisibleItems, insertIndex)` where
`sectionVisibleItems` is the array actually rendered (the group
section's sorted items, or the lane's when ungrouped) — not the
lane-wide array. Positions remain lane-global fractional ranks, which
is fine: inserting between two neighbours of the visible section
yields a rank between those two items. Note: when grouping partitions
a lane, neighbouring ranks may interleave with other sections'
items — accepted, matches how drag in grouped lanes must behave
(the spec pins the visible order of the hovered section).

### D3: Selection lifted to `BoardPage` as a small hook

New `useItemSelection()` hook (state + the existing `SelectionHandle`
shape) instantiated in `BoardPage`, passed to both `TableView` and
`BoardView` as an optional `selection?: SelectionHandle` prop
(undefined for readers — preserves "readers see no checkboxes").
`BulkActionsBar` moves from `TableView` to `BoardPage` so it renders
above either view. Selection is cleared neither on view switch nor on
group-by change; archive continues to clear it (existing behaviour in
the bar). Alternative — React context: rejected as heavier than
needed; exactly one producer and two consumers.

Board cards render the selected state as a distinct outline/tint plus
a checked indicator; no checkbox on cards (Space and bulk bar handle
it), keeping cards compact.

### D4: Roving focus implemented in `BoardView`, not react-aria grid

Board: keep cards as plain focusable elements, add a lane/column-aware
roving-tabindex model in `BoardView` (focused item id in state; the
focused — or first — card has `tabIndex=0`, all others `-1`;
`onKeyDown` on the board container handles arrows). Why not react-aria
`useGridList`/`useDroppableCollection`: it would replace the whole
card/lane rendering and DnD wiring for a layout (columns of cards)
it doesn't model directly; too invasive for this change.

Arrow semantics use the *visible* orders already computed for
rendering (per column, spanning group sections top-to-bottom).
Left/Right target `min(sameVisibleIndex, targetLength - 1)` in the
nearest non-empty column. Focus is remembered per item id, so
re-renders after moves keep focus (`useEffect` re-focuses the moved
item's card after Ctrl+Arrow).

Table: rows get `tabIndex` and a row-level `onKeyDown` via the
existing `Row` render; Up/Down walk a flattened list of all rendered
rows across the per-group `TableRoot`s (refs registered per item row
in render order). We deliberately do not rely on react-aria's grid
navigation since it cannot cross tables.

### D5: One shared shortcut handler on the focused item

A shared helper (e.g. `useItemShortcuts(item, ctx)` or a plain
`handleItemKeyDown(event, item, ctx)`) used by both card and row
`onKeyDown`, so board and table cannot drift. It implements:
Ctrl+Left/Right (column move via `actions.moveItem`, no position ⇒
append), Space (toggle selection), Enter (open menu), s/c/m/a/d/p
(open the respective menu), digits (map to `priorities.find(p =>
p.order === n)`, `0` ⇒ 10, no-op when absent), Delete
(`actions.deleteItem`). Guards: only when `event.target` is the
card/row element itself (the existing `event.target === ref.current`
pattern), no unlisted modifiers, `readonly` items only get navigation
+ Enter, and every handled key calls `preventDefault()`.

Opening submenus from a key reuses the `useRowMenu`/`ItemMenu` stack:
`ItemMenu` gains an optional `initialSubmenu?: 'move' | 'assignee' |
'due' | 'priority'` (rendering only that submenu's entries as a flat
menu when set), and the row-menu state gains an `openForItem(item,
anchorElement, initialSubmenu?)` entry point anchored to the focused
element instead of pointer coordinates. Menu close returns focus to
the item via the existing focus-restore of the menu trigger plus the
roving-focus state. Alternative — synthesizing clicks on the hidden
three-dot trigger: rejected, brittle and cannot open a submenu
directly.

### D6: No document-level listeners

All shortcuts hang off the focused element's `onKeyDown`; nothing
global. This automatically satisfies the scoping requirement (typing
in inputs never hits item handlers; open menus/drawer capture their
own keys) and avoids conflicts with the drawer's Escape listener.

## Risks / Trade-offs

- [react-aria `useDrop` on many small gap zones may thrash renders
  during drag] → zones are tiny stateless components; `isDropTarget`
  state is local to each zone, so only the hovered zone re-renders.
- [jsdom cannot exercise real HTML5 drag events] → keep drop-position
  math in pure helpers (`dropTargetFor(section, index)` →
  `{columnId, position}`) with unit tests; test indicator rendering
  by asserting on zone components' target state where feasible;
  keyboard paths are fully testable with user-event and cover the
  same `moveItem` calls.
- [Single-letter shortcuts vs. future inline editing on cards] → the
  `event.target === element` guard already excludes any child editor;
  documented in the shortcut helper.
- [Digit shortcuts on boards with < 10 priorities silently no-op] →
  matches spec; cheap to discover via the `p` menu.
- [Focus loss after archive (element unmounts)] → the roving-focus
  state computes a successor (next card in column, else previous,
  else column neighbour) before mutating; covered by a test.
- [Enter on a card changes meaning (was: open details, now: open
  menu)] → "Open details" stays the menu's first entry, so
  Enter,Enter reaches the old behaviour; docs updated.

## Open Questions

None — behaviour that was ambiguous in the request (Enter = menu, not
details; append position on Ctrl+Arrow moves; digit no-op semantics)
is pinned in the specs above and can be revisited in review without
affecting the task breakdown.

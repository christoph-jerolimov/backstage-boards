## Context

`ItemCard` (BoardView.tsx:58-166) renders, inside the card `div` (padding 8): a title/menu `Flex` row, then — as bare siblings with no layout parent — the optional external-manager note, the priority chip (wrapped in a `div` with `marginTop: 4`), `DueDateBadge`, `ChecklistBadge`, `AssigneeAvatars`, and the tags text. Whatever subset an item has just stacks flush. `DueDateBadge` and the tags render as block-level `Text`, `ChecklistBadge` and the chips as inline elements, so even the line-breaking behavior differs by field combination.

## Goals / Non-Goals

**Goals:**
- One consistent vertical rhythm inside the card and one horizontal badge row for the compact indicators.
- Identical information, conditions, and interactions — spacing only.

**Non-Goals:**
- No changes to the drawer, table view, my-items, or widgets.
- No new fields, no reordering beyond grouping the badges onto one row.

## Decisions

- Wrap everything below the title row in `<Flex direction="column" gap="1" align="start">` (4px rhythm — cards should stay compact; the title row keeps its place as the first block with the same gap above the stack by making the whole card body a `Flex direction="column" gap="1"` and the title row its first child).
- Put `PriorityChip`, `DueDateBadge`, and `ChecklistBadge` into one `<Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>` row, rendered only when at least one of them is present; drop the `marginTop: 4` wrapper. 8px between badges keeps them readable as separate facts.
- `AssigneeAvatars` and the tags line stay their own rows in the column stack; the external-manager note stays directly under the title.
- Alternative considered: increasing the card padding — rejected, the complaint is about the gaps between facts, not the card edge; padding stays 8.

## Risks / Trade-offs

- [Cards grow a few pixels taller when several fields are present] → accepted; that is the point of the spacing.
- [`board-kanban`, `board-grouped-by-priority`, and `item-drawer` screenshot baselines change] → regenerate light and dark; the board-settings/priority-matrix/my-items/home baselines show no cards and stay untouched.
- [`board-drag.test.ts` drags cards by position] → it locates cards by role/name, not coordinates; verify the suite stays green.

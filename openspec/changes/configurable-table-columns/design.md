## Context

See proposal.md for motivation. Current state:

- `TableView.tsx` hardcodes the columns; `showPriority` (any listed item has a priority) already gates the Priority column. Grouped mode renders one `ItemsTable` per group but shares one sort state — column visibility should be shared the same way.
- `grouping.ts` defines `ITEM_SORT_COLUMNS` (`title`, `status`, `dueDate`, `createdBy`, `updatedAt`) with `toItemSortDescriptor` narrowing and `sortItems` key extraction; `BoardItem` already carries `createdAt` and `updatedBy`.
- Per-user persistence via `storageApiRef` is established in `drafts.ts` (`useDraft`): snapshot for the initial value, `observe$` to adopt the async user-settings payload while untouched. The app backs the storage API with the user-settings service.
- Recent table work: utility columns use `utilityColumnStyle` (fixed widths, `table-layout: fixed`) and `VisuallyHidden` labels; React Aria requires `Column` elements as direct `TableHeader` children, and `TableHeader` accepts a dynamic `columns` array or plain JSX children.

## Goals / Non-Goals

**Goals:**
- A single column-definition source of truth: id, label, sortable, default visibility, cell renderer.
- Two new sortable columns (Created, Updated by); defaults without the audit columns.
- One configure-columns dropdown for the whole table view (shared across groups), persisted per user per board.

**Non-Goals:**
- No changes to the my-items listing, board list, or archived dialog columns.
- No column reordering or widths customization; only show/hide.
- No migration of existing users' implicit expectations — the new defaults apply to everyone without a stored choice.

## Decisions

- **Column model**: a `TABLE_COLUMNS` array in `TableView.tsx` — `{ id, label, sortable }` in display order: `title`, `status`, `priority`, `dueDate`, `assignees`, `tags`, `createdBy`, `createdAt`, `updatedBy`, `updatedAt`; `DEFAULT_VISIBLE = [title, status, priority, dueDate, assignees, tags]`. `ItemsTable` maps the visible subset to `<Column>`/`<Cell>` pairs (React Aria accepts arrays of columns/cells as long as the header and each row agree). Title is not toggleable; Priority renders only when `showPriority && visible`; the actions column stays outside the model.
- **Sorting**: `ITEM_SORT_COLUMNS` gains `createdAt` and `updatedBy`; `sortItems` keys `createdAt` directly (ISO strings compare lexically, like `updatedAt`) and `updatedBy` lowercased (like `createdBy`). Hiding the currently-sorted column keeps the sort applied — harmless, and re-showing restores the header arrow.
- **Persistence**: a `useVisibleColumns(boardId)` hook (new `tableColumns.ts` or beside `drafts.ts`) over `storageApi.forBucket('boards-table-columns')`, key = board id, value = `string[]` of visible column ids. Unknown ids in a stored value are dropped, `title` is always added, absence means the defaults — so old/foreign payloads degrade safely. Same adopt-async-value-while-untouched pattern as `useDraft`; writes are immediate (toggles are rare).
- **The dropdown**: a small `ButtonIcon` (`RiLayoutColumnLine`, `aria-label="Configure columns"`) in a right-aligned row above the table(s), rendered once by `TableView` so grouped mode shares it. `MenuTrigger` + `Menu` of `MenuItem`s, one per hideable column, `✓ `-prefixed when visible (the app's established menu convention); each toggle closes the menu, consistent with every other menu here.
- **Where the button sits**: `TableView` wraps its output in a column flex whose first child is `<Flex justify="end">{configureButton}</Flex>`; no `BoardHeader` changes.

## Risks / Trade-offs

- [React Aria table collections misbehave with conditionally rendered column arrays] → the existing code already renders `showPriority ? <Column/> : null`; keeping header and cells derived from the same visible list preserves the 1:1 pairing. Verified by unit tests and the functional e2e suite.
- [`board-table` screenshot baselines change (audit columns gone by default)] → regenerate light and dark; my-items and other baselines untouched.
- [Users who relied on Created by/Updated being visible] → one menu click brings them back, stored from then on.
- [Stored value shape may evolve] → the hook tolerates unknown ids and missing keys; the bucket name is versioned implicitly by name if a break is ever needed.

## Open Questions

None.

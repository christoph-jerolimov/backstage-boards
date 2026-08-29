## Context

See proposal.md for motivation. The relevant current state:

- `ItemDrawer.tsx` is a hand-rolled fixed-position panel (`role="dialog"` named `Item <title>`), rendering in this order: title row, external notice, watch/delete row, status badge + priority chip row, `Select label="Status"`, `Select label="Priority"`, due date, assignees, description, checklist, tags, metadata, "Activity" heading, `Timeline`, comment composer.
- The plugin is `@backstage/ui` (BUI, React Aria based) only — no MUI. BUI `Tabs/TabList/Tab/TabPanel` is already used in `EntityBoardsContent.tsx` and `BoardListPage.tsx`; controlled `MenuTrigger` (for right-click anchoring) is proven in `RowMenu.tsx`.
- `ItemMenu.tsx` implements the full action set against the `ItemActions` interface and is used by `BoardView`, `TableView`, and `MyItemsPage`; it always renders "Open details" first and hides everything else when `readonly`.
- `StatusBadge.tsx` holds the chip primitives (`StatusChip`, `StatusBadge`, `PriorityChip`, `ColorDot`).
- `getTimeline` returns comments and changes pre-sorted oldest-first; `Timeline` in `ItemTimeline.tsx` renders the flat list, keying change entries by array index.
- The drawer's status `Select` calls `boardsApi.moveItem` directly instead of the optimistic `useMoveItem` mutation from `queries.ts`.
- Test surface: `ItemDrawer.test.tsx` (21 cases), `ItemMenu.test.tsx`, e2e `priorities.test.ts` (locates the priority select as `button name=/Priority/`), `screenshots.test.ts` (`item-drawer.png` snapshot), `my-items-menu.test.ts` / `home-widgets.test.ts` (open/close drawer). Locators that must survive: dialog name `Item <title>`, `Close item details`, `Edit item title`, `Due date`, `Add assignee`, `New comment`, `Comment`.

## Goals / Non-Goals

**Goals:**
- One control per field: interactive status/priority badges replace the badge row + two selects.
- Drawer-visible item menu reusing `ItemMenu` (no forked action list).
- Sectioned layout with headings, using one consistent labelling primitive.
- Client-side activity tabs and ordering over the existing `getTimeline` payload.
- Close the optimistic-move gap for status changes from the drawer.

**Non-Goals:**
- No backend or API changes (no server-side ordering/filtering, no pagination).
- No comment deletion UI (the API exists, but it stays out of scope here).
- No focus-trap/modality rework of the drawer shell.
- No changes to how other surfaces (cards, table, my-items) render status/priority.

## Decisions

### 1. Interactive badges as `MenuTrigger` around a chip-styled button

Add `StatusBadgeSelect` and `PrioritySelect` components (new file `ItemBadgeSelects.tsx` or colocated in `StatusBadge.tsx`): a BUI `MenuTrigger` whose trigger is a real `<Button>`/`ButtonIcon`-style element rendered with the existing `StatusChip` visuals plus a small chevron-down icon (`RiArrowDownSLine`), and whose `Menu` lists the board's columns (respectively priorities sorted by `order` asc plus "No priority"). The current value is marked (`✓ ` prefix, matching `ItemMenu`'s convention).

- Keyboard: a native button inside `MenuTrigger` is focusable and opens with Enter/Space; the menu itself is arrow-key navigable — React Aria gives this for free. Accessible names: `Change status` / `Change priority` (aria-label), with the visible chip text carrying the current value.
- Right-click: make the trigger controlled (`isOpen`/`onOpenChange` state, as `RowContextMenu` already does) and add an `onContextMenu` handler that prevents default and opens the same menu in place. No separate context-menu component is needed because the menu opens at the badge, not at the pointer.
- Read-only/external: render the existing plain `StatusBadge`/`PriorityChip` instead of the trigger — no wrapper button, no chevron.
- Alternative considered: BUI `Select` with a custom trigger — rejected because BUI's `Select` does not expose trigger customization, and restyling its button to look like a chip would fight the library. A `Menu` of options is equivalent for a handful of columns/priorities.

### 2. Status changes go through `useMoveItem`

`StatusBadgeSelect`'s selection handler in the drawer uses the optimistic `useMoveItem` mutation from `queries.ts` (as the board view does), then invalidates the timeline via the drawer's existing `changed()`. This satisfies the "Optimistic item moves … or status change" requirement. On the my-items host (`ItemDrawerHost`), the same mutation applies since it operates on the board cache; verify the host's invalidation still refreshes the listing.

### 3. Drawer header gets `ItemMenu` with a new `showOpenDetails` prop

Extend `ItemMenu` with an optional `showOpenDetails?: boolean` (default `true`); the drawer passes `false`. `ItemActions.openItem` stays required to avoid churn at the other call sites; the drawer passes a no-op. The menu button renders in the title row next to the close button, using the same three-dot `RiMore2Fill` `ButtonIcon` styling as `RowActionsMenu`, labelled `Actions for <title>`.

- Wiring: `moveItem` → optimistic move + `changed()`; `setItemDueDate`/`setAssignees`/`setItemPriority` → `patchItem`-style updates + `changed()`; `deleteItem` → `boardsApi.deleteItem`, then `onClose()` + `onChanged()` (same as today's button).
- `assigneePool`: derived from the board's items' assignees, as `BoardView`/`TableView` do. `BoardWithContext` is available in the drawer on both hosts; if the my-items host's board snapshot lacks items, fall back to the item's own assignees.
- When `readonly` (no write access or externally managed), the menu is not rendered at all: with "Open details" suppressed it would be empty, and the spec forbids an empty menu.
- The standalone "Delete item" button and its row are removed; `WatchButton` moves into the details section (own row, unchanged behavior).

### 4. Sectioned layout via a `DrawerSection` helper

Add `DrawerSection({ title, children })` to `ItemDrawerFields.tsx`: an `<h3>`-level BUI `Text` heading (same style as today's "Activity" heading) over a `Flex direction="column" gap="2"`. New body order:

1. Title row: `InlineEdit` title + item menu + close button
2. External notice (conditional)
3. **Details** section: status badge-select + priority badge-select in one flex row, due date, assignees, watch button
4. **Description** section (`EditableMarkdown`)
5. **Checklist** section (`ChecklistEditor`)
6. **Tags** section (`TagsEditor`)
7. **Activity** section: metadata lines, comment composer, then the tabbed timeline

Existing `DrawerField` labels inside sections stay where they still add information (e.g. "Due date"); the section heading replaces the bare `DrawerField` wrapper for Description/Checklist/Tags to avoid double labels.

### 5. Activity block: client-side tabs + ordering, composer on top

Extract the block into an `ActivityBlock` (in `ItemTimeline.tsx`) owning two pieces of local state: `tab: 'combined' | 'comments' | 'changes'` (default `combined`) and `order: 'newest' | 'oldest'` (default `newest`). Layout: a `Flex justify="between" align="center"` row holding BUI `Tabs` (`TabList` with three `Tab`s: Combined, Comments, Changes) on the left and an ordering toggle `Button variant="tertiary" size="small"` on the right whose label shows the active ordering ("Newest first" ↔ "Oldest first") and flips on press. One list renders below (single `TabPanel` content driven by the selected key — same controlled pattern as `EntityBoardsContent`).

- Data: filter `entries` by `kind` per tab; for `newest` reverse a copy of the server's oldest-first array. No server change.
- Keys: change entries switch from array index to `change.id` (present on `ChangeRecord`) so reordering doesn't remount wrongly.
- The composer (textarea + Comment button, `canWrite`-gated, unchanged locators `New comment`/`Comment`) renders above this flex row, still owned by `ItemDrawer` (draft state stays where it is).
- State is per-drawer-instance (resets on close). Persisting the preference is out of scope.
- Alternative considered: three `TabPanel`s each with its own list — rejected as it triplicates the list markup for no benefit.

### 6. Second round: due-date badge, header watch, inline add controls

- **`DueDateSelect`** joins the badge controls in `ItemBadgeSelects.tsx`. The shared `BadgeSelect` trigger takes arbitrary content, so the due-date chip renders the `DueDateBadge` wording (urgency colors preserved) or a "No due date" placeholder in a neutral chip. Menu entries: Today / Tomorrow / This week (Fri) — via the same `todayISO`/`tomorrowISO`/`fridayISO` helpers the item menu uses — plus "Pick a date…" and a danger "Remove due date" when set. "Pick a date…" swaps the chip for the existing styled `<input type="date">` (auto-focused, `aria-label="Due date"`); committing a value or leaving the input restores the chip. The whole chip opens the menu (consistent with status/priority and keyboard-reachable); the raw input is only one menu entry away, which keeps a single, accessible interaction model instead of splitting text-click and chevron-click behaviors. `DueDateField` in `ItemDrawerFields.tsx` is replaced.
- **Assignees**: `RefChip` gains a `plain` prop that drops the border while keeping avatar, link, and the remove button; `AssigneesField` renders chips and the `PrincipalPicker` in one wrapping row, picker after the chips.
- **Watch button** moves into the drawer's header flex (menu → watch → close ordering keeps the destructive-free corner stable); the Details section keeps status/priority/due date/assignees.
- **Checklist**: the add field renders permanently while editable (plain `TextField`, no autofocus so opening the drawer doesn't steal focus; Enter commits and clears for the next entry). The Add button and `adding` state go away.
- **Tags before Description** is only a reorder of the drawer's sections.

## Risks / Trade-offs

- [E2e screenshot `item-drawer.png` invalidated by any visual change] → regenerate the snapshot as part of the change; review the new image deliberately.
- [E2e `priorities.test.ts` locates the priority control as `button name=/Priority/` with `option` roles] → the new trigger keeps "priority" in its accessible name (`Change priority: <value>`), but options become `menuitem`s; update the locator in the same change.
- [`ItemDrawer.test.tsx` asserts the removed selects, the delete button, and oldest-first order] → rework these cases alongside the implementation; keep the stable locators listed in Context so the other e2e specs pass untouched.
- [Right-click-to-open on a button is unusual and could trap users expecting the browser menu] → scope `onContextMenu` strictly to the badge trigger; everywhere else in the drawer the native menu still works.
- [Reversing/filtering on every render for large timelines] → memoize with `useMemo` keyed on `entries`, `tab`, `order`; timelines are small (no pagination exists today), so this is precautionary.
- [`assigneePool` differs between hosts if the my-items board snapshot lacks items] → acceptable degradation: the submenu still offers "Me" plus current assignees; verify during implementation and mirror `MyItemsPage`'s pool if available.

## Open Questions

None.

## 1. Interactive status and priority badge controls

- [x] 1.1 Build `StatusBadgeSelect` and `PrioritySelect` (controlled `MenuTrigger` around a `StatusChip`-styled button with a chevron affordance, `✓ `-marked current value, "No priority" placeholder and clear entry for priorities, right-click opens the menu via `onContextMenu`, plain `StatusBadge`/`PriorityChip` rendered when read-only); verify with new unit tests covering click-open, right-click-open, keyboard focus + Enter/Space open, selection, clear, and the read-only plain-badge case.
- [x] 1.2 Replace the drawer's badge row and the two `Select`s with the new controls, wiring status selection through the optimistic `useMoveItem` mutation plus timeline invalidation and priority selection through `patchItem`; verify by updating the `ItemDrawer.test.tsx` move-status and set/clear-priority cases to drive the badges (no `Select` queried) and confirming `moveItem`/`updateItem` calls.

## 2. Item menu in the drawer

- [x] 2.1 Add `showOpenDetails` prop (default `true`) to `ItemMenu` that suppresses the "Open details" entry; verify with a new `ItemMenu.test.tsx` case and the existing suite staying green.
- [x] 2.2 Render `ItemMenu` in the drawer's title row (three-dot button labelled `Actions for <title>`, hidden entirely when `readonly`), wire `ItemActions` (optimistic move, due date, assignees, priority via item updates + `changed()`; delete closes the drawer then refreshes; `assigneePool` from the board's items with fallback to the item's assignees), and remove the standalone "Delete item" button and its row (moving `WatchButton` into the Details section); verify by reworking the `ItemDrawer.test.tsx` delete case to go through the menu, adding cases that the menu offers move/due-date/priority/assignee entries and is absent for read-only and external items, and asserting no "Delete item" button renders outside the menu.

## 3. Sectioned drawer layout

- [x] 3.1 Add a `DrawerSection` heading helper to `ItemDrawerFields.tsx` and restructure the drawer body into the design's order (title row → external notice → Details: status/priority badges, due date, assignees, watch → Description → Checklist → Tags → Activity: metadata, composer, tabbed timeline), keeping the stable accessible names (`Item <title>` dialog, `Close item details`, `Edit item title`, `Due date`, `Add assignee`); verify via updated `ItemDrawer.test.tsx` assertions that the section headings render and the full existing drawer suite passes.

## 4. Activity block: tabs, ordering, composer on top

- [x] 4.1 Extract an `ActivityBlock` in `ItemTimeline.tsx` with Combined/Comments/Changes tabs (Combined default), a "Newest first"/"Oldest first" toggle button (newest default) in a flex row beside the tabs, memoized client-side filtering/ordering of the oldest-first server payload, and stable `change.id` keys; verify with unit tests for default newest-first combined order, comments-only and changes-only tabs, and the ordering toggle applying across tabs.
- [x] 4.2 Move the comment composer above the activity tabs in the drawer (unchanged `New comment`/`Comment` locators and `canWrite` gating) and render `ActivityBlock` beneath it; verify by updating the `ItemDrawer.test.tsx` timeline/comment cases for the new order and adding an assertion that the composer precedes the timeline in the DOM.

## 5. Validation and end-to-end alignment

- [x] 5.1 Update `priorities.test.ts` to drive the new priority badge control (menuitem roles, `Change priority` accessible name) and adjust any other e2e locator the rework touched (`my-items-menu.test.ts`, `home-widgets.test.ts` should stay untouched — confirm); verify by running the Playwright suite for the affected specs.
- [x] 5.2 Regenerate the `item-drawer.png` screenshot baseline and review the new image shows the sectioned layout, badge controls with affordance, menu button, and composer-above-tabs activity block; verify `screenshots.test.ts` passes against the new baseline.
- [x] 5.3 Run the full plugin checks — `yarn workspace @internal/plugin-boards test`, `yarn lint`, `yarn tsc`, `yarn prettier:check` — and verify all pass.

## 6. Second round: due-date badge, header watch, inline add controls

- [x] 6.1 Build `DueDateSelect` in `ItemBadgeSelects.tsx` (badge trigger showing the due-date wording with urgency colors or "No due date"; menu with Today/Tomorrow/This week (Fri)/"Pick a date…" and a remove entry when set; "Pick a date…" swaps to a focused date input that commits on change and restores the chip on blur/Escape; plain display when read-only), replace `DueDateField` in the drawer, and verify with new `ItemBadgeSelects.test.tsx` cases (quick options, pick-a-date flow, remove, read-only) plus updated `ItemDrawer.test.tsx` due-date cases.
- [x] 6.2 Make assignee chips borderless via a `plain` prop on `RefChip`/`RefChips` and render the add picker inline after the chips in `AssigneesField`; verify the existing assignee unit tests still pass and the chip row renders without borders.
- [x] 6.3 Move the `WatchButton` into the drawer header next to the item menu and close buttons; verify via the watch unit test and a header-placement assertion.
- [x] 6.4 Show the checklist entry field directly (no Add button, no autofocus on mount) with Enter committing and clearing for the next entry; verify by updating `ChecklistEditor`/`ItemDrawer` tests (type directly, no button press) and the read-only case (no textbox).
- [x] 6.5 Move Tags above Description in the drawer; verify with a section-order assertion in `ItemDrawer.test.tsx`.
- [x] 6.6 Re-run all checks (plugin unit tests, `yarn tsc`, `yarn lint:all`, `yarn prettier:check`), the affected Playwright specs, and regenerate + review the `item-drawer.png` baselines (light and dark).

## 7. Third round: leaner layout, composer in the tabs, persisted drafts

- [x] 7.1 Remove the "Activity" heading and the `ItemMetadata` created-by/updated-by block from the drawer (deleting the now-unused component); verify via updated `ItemDrawer.test.tsx` assertions (no Activity heading, no metadata lines).
- [x] 7.2 Render assignees and tags as a borderless label/value grid in the Details section (labels left; chips plus add controls right; `AssigneesField` without its own label wrapper, `TagsEditor` in the tags cell) and drop the separate Tags section; verify via updated section/order assertions and the existing assignee/tag interaction tests staying green.
- [x] 7.3 Add a `title` slot to `EditableMarkdown` that renders the heading and the action row (History toggle, Add/Edit) in one flex row, used by the drawer's Description block; verify with an `EditableMarkdown` or drawer test asserting the heading row contains the controls.
- [x] 7.4 Move the comment composer into `ActivityBlock` via a `composer` slot shown only on the Combined and Comments tabs — before the list when newest first, after it when oldest first; verify with `ItemTimeline.test.tsx` placement cases and updated drawer composer tests.
- [x] 7.5 Add a `useDraft` hook on `storageApiRef` (bucket `boards-item-drafts`, debounced writes, clear on submit) and wire it to the comment composer and, via new `draft`/`onDraftChange` props on `EditableMarkdown`, to the description editor; verify with unit tests using `mockApis.storage` that drafts restore across remounts and clear on add/save/cancel.
- [x] 7.6 Re-run all checks (plugin unit tests, `yarn tsc`, `yarn lint:all`, `yarn prettier:check`), the affected Playwright specs, and regenerate + review the `item-drawer.png` baselines (light and dark).

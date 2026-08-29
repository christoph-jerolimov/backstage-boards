## 1. Interactive status and priority badge controls

- [ ] 1.1 Build `StatusBadgeSelect` and `PrioritySelect` (controlled `MenuTrigger` around a `StatusChip`-styled button with a chevron affordance, `✓ `-marked current value, "No priority" placeholder and clear entry for priorities, right-click opens the menu via `onContextMenu`, plain `StatusBadge`/`PriorityChip` rendered when read-only); verify with new unit tests covering click-open, right-click-open, keyboard focus + Enter/Space open, selection, clear, and the read-only plain-badge case.
- [ ] 1.2 Replace the drawer's badge row and the two `Select`s with the new controls, wiring status selection through the optimistic `useMoveItem` mutation plus timeline invalidation and priority selection through `patchItem`; verify by updating the `ItemDrawer.test.tsx` move-status and set/clear-priority cases to drive the badges (no `Select` queried) and confirming `moveItem`/`updateItem` calls.

## 2. Item menu in the drawer

- [ ] 2.1 Add `showOpenDetails` prop (default `true`) to `ItemMenu` that suppresses the "Open details" entry; verify with a new `ItemMenu.test.tsx` case and the existing suite staying green.
- [ ] 2.2 Render `ItemMenu` in the drawer's title row (three-dot button labelled `Actions for <title>`, hidden entirely when `readonly`), wire `ItemActions` (optimistic move, due date, assignees, priority via item updates + `changed()`; delete closes the drawer then refreshes; `assigneePool` from the board's items with fallback to the item's assignees), and remove the standalone "Delete item" button and its row (moving `WatchButton` into the Details section); verify by reworking the `ItemDrawer.test.tsx` delete case to go through the menu, adding cases that the menu offers move/due-date/priority/assignee entries and is absent for read-only and external items, and asserting no "Delete item" button renders outside the menu.

## 3. Sectioned drawer layout

- [ ] 3.1 Add a `DrawerSection` heading helper to `ItemDrawerFields.tsx` and restructure the drawer body into the design's order (title row → external notice → Details: status/priority badges, due date, assignees, watch → Description → Checklist → Tags → Activity: metadata, composer, tabbed timeline), keeping the stable accessible names (`Item <title>` dialog, `Close item details`, `Edit item title`, `Due date`, `Add assignee`); verify via updated `ItemDrawer.test.tsx` assertions that the section headings render and the full existing drawer suite passes.

## 4. Activity block: tabs, ordering, composer on top

- [ ] 4.1 Extract an `ActivityBlock` in `ItemTimeline.tsx` with Combined/Comments/Changes tabs (Combined default), a "Newest first"/"Oldest first" toggle button (newest default) in a flex row beside the tabs, memoized client-side filtering/ordering of the oldest-first server payload, and stable `change.id` keys; verify with unit tests for default newest-first combined order, comments-only and changes-only tabs, and the ordering toggle applying across tabs.
- [ ] 4.2 Move the comment composer above the activity tabs in the drawer (unchanged `New comment`/`Comment` locators and `canWrite` gating) and render `ActivityBlock` beneath it; verify by updating the `ItemDrawer.test.tsx` timeline/comment cases for the new order and adding an assertion that the composer precedes the timeline in the DOM.

## 5. Validation and end-to-end alignment

- [ ] 5.1 Update `priorities.test.ts` to drive the new priority badge control (menuitem roles, `Change priority` accessible name) and adjust any other e2e locator the rework touched (`my-items-menu.test.ts`, `home-widgets.test.ts` should stay untouched — confirm); verify by running the Playwright suite for the affected specs.
- [ ] 5.2 Regenerate the `item-drawer.png` screenshot baseline and review the new image shows the sectioned layout, badge controls with affordance, menu button, and composer-above-tabs activity block; verify `screenshots.test.ts` passes against the new baseline.
- [ ] 5.3 Run the full plugin checks — `yarn workspace @internal/plugin-boards test`, `yarn lint`, `yarn tsc`, `yarn prettier:check` — and verify all pass.

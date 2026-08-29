## Why

The item detail drawer has grown organically and is getting cluttered: status and priority appear twice (a nice read-only badge row plus two labelled selects), the only bulk action is a bare "Delete item" button sitting near the top while every other surface offers the full item menu, the fields run together without visual structure, and the activity timeline is oldest-first with the comment composer buried at the very bottom of a potentially long scroll.

## What Changes

- **Merge the duplicate status and priority displays into interactive badges.** The status badge and priority chip become the controls: clicking (or right-clicking) one opens the picker, they are keyboard-focusable and operable, and they carry a visible affordance (dropdown indicator) so the select capability is discoverable. The separate "Status" and "Priority" selects are removed. Read-only viewers and externally managed items get the plain, non-interactive badge.
- **Give the drawer visible structure.** Fields are grouped under headlined sections (details fields, description, checklist, tags, activity) instead of one flat stack.
- **Replace the standalone "Delete item" button with the full item menu.** The drawer header offers the same item menu as cards and rows (move to column, due date shortcuts, priority, assignees, delete), minus the redundant "Open details" entry. Deleting from the menu closes the drawer.
- **Rework the activity block.** Comments and changes are still available combined, but newest first by default, with tabs to switch between "Combined", "Comments", and "Changes" and a control to flip the ordering between "Newest first" and "Oldest first". The new-comment composer moves above this block so writing a comment never requires scrolling past the history.
- Status changes made from the drawer go through the optimistic move mutation, closing an existing gap against the "Optimistic item moves" requirement (implementation alignment, no new spec text).

Follow-up refinements (same change, second round):

- **Due date becomes a badge control too.** Like status and priority, the due-date text is the control: its menu offers Today, Tomorrow, This week (Friday), "Pick a date…", and a remove entry when set. "Pick a date…" swaps the chip for a focused date input so any calendar date stays reachable. The always-visible date input and separate Clear button go away.
- **Assignees lose the chip borders and the add control moves inline** behind the existing assignees instead of sitting on its own row below.
- **The watch button moves into the drawer header**, next to the item menu and close buttons.
- **The checklist offers its entry field directly** — no "Add" button to press before typing.
- **Tags move above the description.**

Third round:

- **The Activity heading and the created-by/updated-by metadata lines go away** — the tab row identifies the block on its own.
- **Assignees and tags render as one borderless label/value table** in the Details section: labels on the left, the chips and add controls on the right.
- **The Description heading becomes a flex row** with the Add/Edit and History controls on its right.
- **The comment composer moves into the activity tabs**: shown on the Combined and Comments tabs only, before the timeline when newest-first and after it when oldest-first — always adjacent to where the new comment will appear.
- **Comment and description drafts survive reload**: in-progress text is persisted per user through the Backstage storage (user settings) API and cleared once the comment is added or the description saved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/comments-and-history`: The "Unified timeline in item detail view" requirement changes — the detail view's activity block gains Combined/Comments/Changes tabs (Combined remains the default), a newest-first default ordering with a user-facing toggle, and the comment composer placed above the timeline.
- `boards/item-management`: New requirements for the drawer — the full item menu is offered in the drawer (replacing the standalone delete button), the drawer content is grouped into headlined sections, and the drawer's status display and status editor merge into one accessible interactive badge control.
- `boards/item-priorities`: The "Edit priority from drawer and item menu" requirement changes — the drawer's priority display and priority editor merge into one accessible interactive badge control; read-only users see only the plain badge.
- `boards/item-management` (second round): The "Arbitrary due date in details view" requirement changes — the due-date display and editor merge into one badge control with quick options plus a full date picker behind "Pick a date…"; the "Structured details drawer" requirement (added by this change) is adjusted for the new section order (tags before description) and the watch control in the header.
- `boards/item-checklists`: The "Checklist editing in the item details drawer" requirement changes — the entry field is offered directly instead of behind an Add button.
- `boards/comments-and-history` (third round): the composer moves inside the Combined/Comments tabs with ordering-dependent placement, and a new requirement covers per-user draft persistence for comments and description edits.
- `boards/item-management` (third round): the "Structured details drawer" requirement is adjusted — no Activity heading or metadata block, assignees/tags as a borderless label/value table, description heading carrying its controls.

## Impact

- `plugins/boards/src/components/ItemDrawer.tsx` — restructure: header with item menu, sectioned layout, badge-select controls, activity tabs/ordering, composer placement, optimistic status move.
- `plugins/boards/src/components/ItemDrawerFields.tsx` — section/heading helper.
- `plugins/boards/src/components/StatusBadge.tsx` — interactive variants of the status/priority chips (or a wrapper component).
- `plugins/boards/src/components/ItemMenu.tsx` — option to omit the "Open details" entry when rendered inside the drawer.
- `plugins/boards/src/components/ItemTimeline.tsx` — filtering/ordering support and stable keys for change entries.
- Tests: `ItemDrawer.test.tsx` (large rework), `ItemMenu.test.tsx` (new prop), e2e `priorities.test.ts` (locator for the new priority control), e2e screenshot `item-drawer.png` (must be regenerated).
- No backend/API changes: `getTimeline` stays oldest-first; the frontend orders and filters client-side.

## 1. Assignees in the shared filter shape

- [ ] 1.1 Add `assignees?: string[]` to `ItemFilter` in
      `plugins/boards-common/src/filter.ts`, document the mixed
      semantics in its doc comment (text AND tags AND any-of
      assignees), and make `itemMatchesFilter` return false when the
      filter lists assignees and the item shares none of them; verify
      an item assigned to one of two selected assignees matches and an
      item assigned to a third does not
- [ ] 1.2 Extend `isEmptyFilter` so a filter carrying only assignees is
      not empty; verify with a `filter.test.ts` case
- [ ] 1.3 Cover in `filter.test.ts` that assignees combine with text and
      tags by AND, that an empty `assignees` array matches everything,
      and that an unassigned item never matches a filter listing
      assignees; verify
      `yarn workspace @internal/plugin-boards-common test` passes

## 2. Assignee dropdown in the filter bar

- [ ] 2.1 Move `useProfiles` (and its `Profile` type and
      `refFallbackName` helper) out of `AssigneeAvatars.tsx` into
      `plugins/boards/src/components/useProfiles.ts`, exported
      unchanged, and import it back in `AssigneeAvatars.tsx`; verify
      `AssigneeAvatars.test.tsx` passes without edits
- [ ] 2.2 In `BoardPage.tsx`, derive `allAssignees` from the loaded
      items next to `allTags`, resolve labels with `useProfiles` for the
      catalog refs and `textRefDisplay` for `text:` refs, and sort the
      options by label with `localeCompare`; verify a board whose refs
      sort differently from their display names is ordered by display
      name
- [ ] 2.3 Add `filterAssignees` state and render an "Assignees"
      `MenuTrigger`/`Menu` beside the tag dropdown — same `✓` toggle
      markup, same `(n)` count in the button label, rendered only when
      `allAssignees.length > 0` — and pass `assignees: filterAssignees`
      into the `ItemFilter` handed to `itemMatchesFilter`; verify
      selecting an assignee filters both the board and the table view
- [ ] 2.4 Include `filterAssignees` in the "Clear filters" reset; verify
      the counter and the clear button appear with only an assignee
      selected and that clearing restores every item

## 3. API parity

- [ ] 3.1 Parse repeated `?assignee=` into `filter.assignees` with the
      existing `asArray` in the items route of
      `plugins/boards-backend/src/router.ts`; verify via
      `router.test.ts` that one and several parameters both reach
      `listItems`
- [ ] 3.2 In `BoardsService.listItems`, add a single `whereExists` over
      `item_assignees` with `whereIn` on `filter.assignees` (skipped
      when the list is empty), leaving the per-tag loop untouched;
      verify with `BoardsService.test.ts` cases that a single assignee
      returns their items, two assignees return the union, and an
      assignee combined with a tag returns the intersection

## 4. Behavior coverage

- [ ] 4.1 In `BoardPage.test.tsx`, cover the spec scenarios: the
      dropdown lists exactly the board's assignees (catalog display name
      and `text:` display text, nobody else), selecting two assignees
      keeps items of either, and no assignee dropdown is rendered on a
      board without assignees
- [ ] 4.2 Cover that an assignee selection AND-combines with an active
      tag and text filter, and that the "N of M items" counter reflects
      the assignee filter

## 5. Verification

- [ ] 5.1 Run `yarn workspace @internal/plugin-boards test`,
      `yarn workspace @internal/plugin-boards-common test`,
      `yarn workspace @internal/plugin-boards-backend test`,
      `yarn prettier:check` and `yarn lint:all`; verify all pass
- [ ] 5.2 Start the app (`yarn start`), open a board with several
      assignees including a free-text one, filter by one and by two
      assignees, combine with a tag, and clear; verify the visible
      items, the counter, and both views match the spec scenarios

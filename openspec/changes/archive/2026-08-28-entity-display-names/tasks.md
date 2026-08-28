## 1. The naming rule, in one pure function

- [x] 1.1 Add `entityDisplayName(ref: string, entity?: Entity): string` to
      `plugins/boards-common/src/refs.ts`, returning
      `spec.profile.displayName` for entities whose lowercased `kind` is
      `user` or `group`, then `metadata.title`, then `metadata.name`, and
      falling back to `refDisplayName(ref)` when the entity is undefined
      or carries none of them; leave `refDisplayName` itself unchanged
- [x] 1.2 Cover it in `refs.test.ts`: a user resolved by profile display
      name, a group resolved by profile display name (not by title), a
      component resolved by title, an entity with only a name, `kind`
      given as `User` and as `user`, a `text:` ref, an unparseable ref,
      and `entity` undefined; verify
      `yarn workspace @internal/plugin-boards-common test` passes

## 2. One resolver in the frontend

- [x] 2.1 Rewrite the label branch of `useProfiles` to call
      `entityDisplayName(ref, entity)` instead of spelling the chain out
      inline, keeping its signature, query key, `staleTime` and picture
      handling as they are; verify `AssigneeAvatars.test.tsx` and
      `BoardPage.test.tsx` pass unchanged
- [x] 2.2 Add an `AssigneeAvatars.test.tsx` case for a `group:` ref whose
      entity has both a profile display name and a title, asserting the
      profile display name wins — the extraction is behavior-preserving
      here, so this case pins the rule the component now inherits rather
      than changing it; verify it passes

## 3. Resolved names in the assignee submenu

- [x] 3.1 In `ItemMenu.tsx`, resolve the `assigneePool` through
      `useProfiles` and use the resolved label both for the entry text
      and as the `localeCompare` sort key, keeping the "Me" entry first
      and the `✓` marking as they are; verify with an `ItemMenu.test.tsx`
      case that a pool of two refs whose display names sort opposite to
      their ref names is listed in display-name order
- [x] 3.2 Verify in the same test file that the menu renders its entries
      unchanged when the catalog resolves nothing (bare ref names, no
      crash), covering the fallback scenario

## 4. The ref as a tooltip

- [x] 4.1 In `AssigneeAvatars.tsx`, give the single-assignee name the
      full ref as a `title` (no extra tab stop around the link) and
      extend the stacked-avatar tooltip to show the display name and the
      ref on separate lines; leave `text:` badges untouched; verify by
      test that both carry the ref and that a `text:` badge offers
      neither
- [x] 4.2 In `BoardFilterBar.tsx` and `ItemMenu.tsx`, attach the full ref
      to each catalog-ref entry's label — a `TooltipTrigger` if it works
      inside a `MenuItem`, otherwise a `title` on the label span — and
      leave `text:` entries without one; verify by test that the entry
      exposes the ref and that keyboard navigation through the menu still
      selects the right entry
- [x] 4.3 Verify the tooltip does not leak into the accessible name of
      the menu entries (`getByRole('menuitem', { name: 'Bob Builder' })`
      still matches), adjusting the markup if it does

## 5. Verification

- [x] 5.1 Run `yarn workspace @internal/plugin-boards test`,
      `yarn workspace @internal/plugin-boards-common test`,
      `yarn tsc`, `yarn prettier:check` and `yarn lint:all`; verify all
      pass
- [x] 5.2 Start the app (`yarn start`), assign a user with a profile
      display name, a group with one, and a free-text assignee to items
      on one board; verify all three read by their display name on the
      cards, in the assignee filter and in the assignee submenu, that the
      submenu and the filter agree on the order, and that hovering a
      catalog name shows its full ref while the free-text one shows none

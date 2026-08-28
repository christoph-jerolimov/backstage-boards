## Context

See `proposal.md` — Why. What the code offers today:

- `refDisplayName(ref)` (`plugins/boards-common/src/refs.ts:22`) is pure
  and synchronous: a `text:` ref's text, else `parseEntityRef(ref).name`,
  else the ref itself. It is used by `ItemMenu` (label and sort key),
  and as the last fallback by `useProfiles`, `AssigneeAvatars` and
  `BoardFilterBar`.
- `useProfiles(entityRefs)` (`plugins/boards/src/components/useProfiles.ts`)
  batch-fetches `kind`, `metadata` and `spec.profile` through
  `catalogApi.getEntitiesByRefs`, keyed on the sorted ref list with a
  5 minute `staleTime`, and already resolves
  `spec.profile.displayName ?? metadata.title ?? metadata.name ??
  refDisplayName(ref)` — the rule this change wants, applied to one kind
  of caller and living inside a React hook where it cannot be unit
  tested on its own.
- `AssigneeAvatars` renders a name tooltip per avatar only when several
  assignees stack; a single assignee is an `EntityRefLink` (with
  `disableTooltip`) next to its avatar. `BoardFilterBar` labels the
  assignee dropdown from `useProfiles`. `ItemMenu` does neither.
- `RefDisplay` / `EntityRefList` (`common.tsx`) hand refs to Backstage's
  own `EntityRefLink`, which resolves and titles them itself.

## Goals / Non-Goals

**Goals:**

- One naming rule, in one place, that every surface naming a ref shares
  — including the assignee submenu, which today disagrees with the
  filter about both the label and the sort order.
- The rule testable without React, a catalog, or a rendered component.
- No new fetching: the surfaces that gain resolved names ride the
  request `useProfiles` already makes for the cards.

**Non-Goals:**

- Changing surfaces that delegate naming to Backstage: `RefDisplay`,
  `EntityRefList`, the entity pickers, comment mentions. `EntityRefLink`
  owns their label and their tooltip; overriding it would make the
  plugin disagree with the rest of the app.
- Fetching entities a page does not already need — no lookups for refs
  that are never displayed, and no per-ref requests.
- Changing what is stored. Refs stay refs; this is presentation only.
- Reworking `useProfiles`'s caching, batching, or its `staleTime`.

## Decisions

**Split the rule from the fetching: `entityDisplayName(ref, entity?)`
in `boards-common`, `useProfiles` keeps the catalog work.**
The requested behavior needs catalog data, but `boards-common` has no
catalog access and is shared with the backend, so `refDisplayName`
cannot grow into it. A pure `(ref, entity | undefined) => string`
carries the whole priority chain, is exhaustively unit-testable per kind
and per missing field, and leaves `useProfiles` doing nothing but the
request. `refDisplayName` keeps its current signature and becomes the
`entity === undefined` branch, so every existing caller — the backend
included — is unaffected.

**`spec.profile.displayName` for `User` and `Group`, `metadata.title`
for every other kind.**
Backstage models a display name on both user and group profiles, and its
own `EntityDisplayName` treats them alike; a `Group` whose profile says
"Team Alpha" should not read as "team-a" just because it is not a user.
Other kinds have no profile, so `metadata.title` is their equivalent —
and checking title for users too, below the profile, costs nothing and
keeps the chain a single ordered list.

**Kind comparison is case-insensitive on the entity's `kind`, not on the
ref string.**
`parseEntityRef` is already the plugin's way of reading a ref, but the
kind that matters is the resolved entity's (`entity.kind`, which the
catalog returns as `User`/`Group`). Refs are written in every casing;
comparing lowercased kinds avoids a rule that works for `user:` and
fails for `User:`.

**Tooltips carry the full ref, and only where the plugin itself wrote
the label.**
The three surfaces in scope are exactly the ones that now show a name
the ref does not contain, so they are the ones where the ref went
missing. `EntityRefLink` surfaces already carry Backstage's own
behavior. A `text:` ref gets no tooltip — its label *is* its value, and
a tooltip repeating it with a `text:` prefix is noise.

**Design-system `Tooltip` where an element can host one, the native
`title` attribute inside menu items.**
Avatars and the single-assignee name are ordinary hoverable/focusable
elements: `TooltipTrigger` + `Tooltip` works there and matches the
existing avatar stack. Menu entries are owned by react-aria's menu,
which manages focus and its own overlays; nesting a `TooltipTrigger`
inside a `MenuItem` risks fighting that. A `title` on the label span
inside the item needs nothing from the menu, degrades to no tooltip at
worst, and keeps the entry keyboard-navigable. If a `TooltipTrigger`
turns out to work cleanly in a `MenuItem` during implementation, it is
the better rendering and should be used instead — the requirement is the
ref being reachable, not the mechanism.

**The stacked-avatar tooltip shows the name *and* the ref.**
It shows the display name today, and an avatar is initials — replacing
the name with the ref would trade one missing fact for another. The two
go on separate lines, name first.

**`ItemMenu` resolves through `useProfiles(assigneePool)` and sorts by
the resolved label.**
It is a component, so the hook is available to it, and the pool is the
board's assignee set — the same sorted ref list the cards and the filter
already query, so react-query serves it from cache and the menu costs no
extra request no matter how many rows mount one.

## Risks / Trade-offs

- **Labels and menu order settle asynchronously.** Before the catalog
  answers, names fall back to the bare ref name and the assignee submenu
  sorts by it, then both change. On a board whose cards already rendered
  their avatars the query is warm and nothing visibly moves; on a cold
  first paint of the menu it can reorder once. Accepted — the
  alternative is blocking the menu on a request.
- **A tooltip in a menu may not survive react-aria's focus handling.**
  Mitigated by using the native `title` there, which nothing can
  intercept; the design-system tooltip is used where it already works.
- **Two entities sharing a display name still look identical until
  hovered.** The tooltip is the disambiguator; putting the ref on screen
  permanently would bloat every card. Accepted.
- **Only the assignee submenu changes what it displays.** The avatars
  and the filter already resolve through `useProfiles`, whose inline
  chain is the rule being extracted, so for them this is a refactor plus
  a tooltip; the submenu is where names visibly change. Worth knowing
  when reading the diff: most of the naming code moves without moving
  behavior, and the tests that pin it should keep passing untouched.
- **The rule narrows `spec.profile.displayName` to `User` and `Group`.**
  Today's inline chain reads a profile display name off any kind that
  happens to have one. No other kind carries `spec.profile` in
  Backstage's model, so the narrowing is not expected to change a label
  — but it is a difference, not a pure move.

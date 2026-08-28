## Context

See `proposal.md` — Why. The pieces this change assembles all exist:

- `ItemFilter` (`plugins/boards-common/src/filter.ts`) is `{ text?, tags? }`
  with `itemMatchesFilter` and `isEmptyFilter` beside it. It is the one
  filter shape shared by the client (`BoardPage.tsx:215`) and the server
  (`BoardsService.listItems`, `BoardsService.ts:1182`).
- The filter bar in `BoardPage.tsx` holds `filterText` and `filterTags`
  in component state, derives `allTags` from the loaded items, renders
  the tag dropdown as a `MenuTrigger` + `Menu` with `✓`-prefixed items,
  and shows the counter plus "Clear filters" while `filterActive`.
- `groupByAssignee` (`grouping.ts`) already walks `item.assignees` and
  treats an item with several assignees as belonging to each of them —
  the same fan-out the filter needs, one item matching if any of its
  assignees is selected.
- `useProfiles` in `AssigneeAvatars.tsx` batch-resolves refs to
  `{ displayName, picture }` through `catalogApi.getEntitiesByRefs`,
  keyed on the sorted ref list with a 5 minute `staleTime`, and falls
  back to the ref's name when the catalog has nothing. It is currently
  module-private.
- `isTextRef` / `textRefDisplay` (`refs.ts`) separate free-text
  assignees from catalog refs; `AssigneeAvatars` renders the former as
  badges.
- The router already parses `?text=` and repeated `?tag=` into an
  `ItemFilter` via `asArray` (`router.ts:299`).

## Goals / Non-Goals

**Goals:**

- One filter shape end to end: whatever the dropdown can express, the
  API expresses too, so the spec's "the items API SHALL accept the same
  filters" stays true.
- Labels in the dropdown identical to the labels on the cards — the same
  resolver, not a second one that could disagree about a display name.
- The filter bar keeps behaving as one unit: counter, "Clear filters",
  and AND-combination extend to the new filter without special cases.

**Non-Goals:**

- An "Unassigned" entry. The ask is the assignees in use; an unassigned
  bucket needs a sentinel in the shared filter shape and its own SQL
  branch, and group-by-assignee already surfaces that set. Worth its own
  change if it is wanted.
- Persisting filters in the URL or across reloads. Text and tag filters
  are component state today; the assignee filter matching them is the
  consistent choice, and changing all three is a separate change.
- Filtering by assignee anywhere else — the archived-items dialog, the
  "Assigned items" home widget (already scoped to the viewer), or the
  board list.
- Server-driven filtering for the board page. The page loads a board's
  items once and filters in memory; the API parameter is for API
  consumers, not a new fetch on every dropdown click.

## Decisions

**Any-of (OR) across selected assignees, and-with everything else.**
The tag filter is all-of because tags stack on one item ("bug" *and*
"urgent"). Assignees stack too, but the question people ask is "what is
on Alice's or Bob's plate", not "what did Alice and Bob take jointly".
All-of would make a two-person selection return nothing on most boards,
which reads as a broken filter. The mixed semantics are stated in the
spec requirement and shown in the UI by the plural label; the
combination *between* filters stays AND, so "Alice or Bob, tagged bug,
matching 'login'" works as expected.

**`assignees?: string[]` on `ItemFilter`, not a new filter type.**
`itemMatchesFilter` gains one loop and `isEmptyFilter` one clause, and
every caller — client and server — keeps passing a single object. A
parallel `AssigneeFilter` threaded separately would mean two things to
combine at every call site and two things for the API to parse.

**Extract `useProfiles` into `plugins/boards/src/components/useProfiles.ts`
and import it in both `AssigneeAvatars` and `BoardPage`.**
Copying the hook would give the dropdown its own catalog query and its
own fallback logic, so a card could say "Alice Smith" while the dropdown
said "alice". Sharing it also shares the react-query cache: the card
avatars have usually already fetched the very refs the dropdown needs
(same sorted-ref query key), so opening the dropdown normally costs no
request. The hook keeps its current signature and behavior; only its
home changes.

**Derive the option list from the loaded items, next to `allTags`.**
`allAssignees = [...new Set(items.flatMap(item => item.assignees))]`,
sorted by resolved label with `localeCompare`, mirrors the existing
`allTags` line and needs no new API call — the board page already holds
every item. Sorting by label rather than by ref puts "Alice Smith"
before "Bob" regardless of their `user:default/...` refs.

**Do not prune selections that leave the board.**
If the last item assigned to Bob is reassigned while "Bob" is selected,
the selection stays and the board shows zero items, with "Clear filters"
in reach. This is what the tag filter already does, and silently
dropping a selection would make the counter change for no visible
reason.

**Repeated `?assignee=` on the items endpoint, parsed with the existing
`asArray`, matched with a single `whereExists ... whereIn`.**
One `whereExists` over `item_assignees` with `whereIn` on the selected
refs is the OR semantics in SQL, and it mirrors the per-tag
`whereExists` loop directly above it (which is a loop precisely because
tags are AND). Ref comparison stays exact and case-sensitive, as
everywhere else assignee refs are compared.

## Risks / Trade-offs

- **Two dropdowns side by side with different combination rules** (tags
  all-of, assignees any-of) → the label is plural on both and neither
  claims otherwise; the counter makes the effect immediately visible,
  and one selection per dropdown — the common case — behaves identically
  either way.
- **A board with many distinct assignees makes a long menu** → the same
  shape the tag menu already has on a heavily tagged board, and the list
  is bounded by the people actually on the board's cards. A searchable
  picker is a later refinement for both menus, not one for this filter
  alone.
- **The catalog may not resolve a ref** (deleted user, catalog
  unavailable) → `useProfiles` already falls back to the ref's name, so
  the entry stays selectable and filters correctly; only its label is
  less pretty. Sorting then uses that fallback label.
- **Moving `useProfiles` touches `AssigneeAvatars`**, which is rendered
  on every card → the move is mechanical (no signature change) and the
  existing `AssigneeAvatars` tests cover it; they run unchanged.

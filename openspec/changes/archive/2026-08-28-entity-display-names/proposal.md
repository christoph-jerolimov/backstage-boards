## Why

`refDisplayName` is the boards plugin's answer to "what do I call this
ref?", and it answers from the ref string alone: `user:default/csmith`
reads as "csmith" even when the catalog knows that entity as "Christoph
Smith". Only `AssigneeAvatars` and the assignee filter do better, and
only because `useProfiles` fetches profiles behind their backs — the
card's three-dot Assignee submenu, which lists the same people, still
shows the bare names, and it sorts by them, so the same board offers
one order in the menu and another in the filter.

The other half of the problem is the opposite one: once a ref reads as
"Christoph Smith", there is nowhere left to see *which* entity that is.
Two people with the same display name are indistinguishable, and the ref
that has to be typed into a config or an API call is no longer on screen
anywhere.

## What Changes

- Resolve a ref's display name from the catalog entity it points at:
  `spec.profile.displayName` for `User` and `Group` entities,
  `metadata.title` for every other kind, then `metadata.name`, then
  today's behavior (the ref's own name, or a `text:` ref's text) when
  the entity is unknown or not loaded yet.
- Put that rule in one pure function in `boards-common` that takes the
  ref and the entity, so the frontend hook that already fetches entities
  is the only thing that knows how to fetch, and the naming rule itself
  is testable without React or a catalog.
- Use resolved names everywhere the plugin names a ref itself: the
  avatar row and its tooltips, the assignee filter dropdown, and the
  card/row Assignee submenu — which also starts sorting by the resolved
  name, so the menu and the filter list people in the same order.
- Show the full entity ref (`user:default/csmith`) as a tooltip wherever
  one of those resolved names is displayed, so the underlying identity
  stays reachable. `text:` refs get no tooltip: their label already is
  their whole value.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: gains a requirement fixing how a ref is
  named on screen and that its full ref stays available as a tooltip,
  covering the surfaces that name refs themselves (avatars, assignee
  filter, assignee submenu).

## Impact

- **Common.** `plugins/boards-common/src/refs.ts`: a new
  `entityDisplayName(ref, entity?)`. `refDisplayName` keeps its
  signature and behavior and becomes that function's fallback, so the
  backend and every non-catalog caller are untouched.
- **Frontend.** `useProfiles.ts` delegates to the new function;
  `AssigneeAvatars.tsx`, `BoardFilterBar.tsx` and `ItemMenu.tsx` show
  resolved names with ref tooltips, and `ItemMenu` gains the profile
  lookup it does not do today.
- **No backend, API, schema, config, or dependency change.**
  `@backstage/catalog-model` is already a `boards-common` dependency, and
  the catalog request the frontend needs is the one `useProfiles` already
  makes.

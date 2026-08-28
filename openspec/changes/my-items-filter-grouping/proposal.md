## Why

The "My items" page (and the identical "My items" tab on the boards page)
is the one place a user sees everything assigned to them across every
board. It is also the only item listing in the plugin with no way to
narrow or reorganise what it shows: the board page has a filter bar
(search + tags) and a group-by dropdown, my-items has neither. It always
renders one table per board, in board order, with every item.

That is fine with a handful of items and unusable with fifty. A user who
wants "what is overdue", "everything tagged `release`", or "only the
items that are mine because I am in team-a" has to read the whole page.
The two controls that answer those questions already exist one click
away on the board page — my-items just does not offer them.

## What Changes

- **Filter bar on my-items**, mirroring the board page's:
  1. A free-text search field matching item title and description,
     case-insensitive — the same matching the board page already uses.
  2. A tag dropdown offering the tags in use on the listed items;
     selecting several keeps items carrying **all** of them.
  3. An assignee dropdown, shown only when the listed items are the
     user's through **more than one** of their own identities (their user
     ref plus their ownership group refs — e.g. items assigned to them
     personally and items assigned to `group:default/team-a`). Selecting
     assignees keeps items assigned to **any** of them. With a single
     identity in play the dropdown is hidden, because it could not
     exclude anything.
  4. A count ("12 of 40 items") and a "Clear filters" button while a
     filter is active, and a distinct empty state when nothing matches.

- **Group-by dropdown on my-items**, in the same `Select` control shape
  the board page uses, offering: **board** (the default, today's
  behavior), **not grouped**, **due date**, and **tags**.
  - Grouping by tags puts a multi-tag item into each of its tag groups
    and collects untagged items in a trailing "Untagged" group — the same
    semantics board grouping already has.
  - Grouping by due date orders groups by urgency (overdue first) with
    undated items last.
  - When the grouping is not by board, the table gains a **Board**
    column, so a row still says where it lives.

- Both controls live in `MyItemsList`, so the standalone `/my-items` page
  and the boards page's "My items" tab get them together.

- The tag filter menu is extracted from `BoardPage` into a shared
  component, so both filter bars stay one implementation.

## Capabilities

### Modified Capabilities

- `boards/item-management`: the my-items sub-page gains a filter bar
  (text, tags, and — when relevant — assignee identity) and a grouping
  option, replacing its fixed group-by-board rendering.

## Impact

- **`boards`** (frontend only): `components/MyItemsPage.tsx` gains the
  filter bar, the group-by dropdown and the conditional Board column;
  `components/grouping.ts` gains the `none` and `tags` grouping modes and
  a my-items filter helper; a new shared tag-filter menu component that
  `BoardPage` also adopts.
- **No backend or API change.** `GET /my-items` already returns every
  field the filters need (title, description, tags, assignees, due date),
  and the page already holds the full result client-side, so filtering
  and grouping happen in the browser with no extra request.
- **No change** to the home page "Assigned items" widget: its own
  grouping setting keeps its current three values, even though the
  underlying grouping type widens.
- **`boards-common`**: unchanged — `ItemFilter` keeps its current shape
  because the assignee facet is my-items-only and never reaches the API.

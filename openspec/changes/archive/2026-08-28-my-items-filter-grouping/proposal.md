## Why

The "My items" page (and the identical "My items" tab on the boards page)
is the one place a user sees everything assigned to them across every
board. It is also the only item listing in the plugin with no way to
narrow or reorganise what it shows: the board page has a filter bar
(search, tags, assignees) and a group-by dropdown, my-items has neither.
It always renders one table per board, in board order, with every item.

That is fine with a handful of items and unusable with fifty. A user who
wants "what is overdue", "everything tagged `release`", or "only the
items that are mine because I am in team-a" has to read the whole page.
Both controls already exist one click away on the board page — and since
the board filter bar became a reusable `useItemFilter` hook plus a
`BoardFilterBar` component, offering them on my-items is mostly wiring,
not new machinery.

## What Changes

- **The board page's filter bar is reused on my-items**, renamed
  `ItemFilterBar` because it is no longer board-only. My-items therefore
  gets, with the same semantics and the same catalog-resolved assignee
  names the board page already shows:
  1. free-text search over item title and description,
  2. a tag filter, where an item must carry **all** selected tags,
  3. an assignee filter, where an item must be assigned to **any** of the
     selected assignees,
  4. the "N of M items" count and the "Clear filters" button.

- **The assignee filter appears on my-items only when the listed items
  carry more than one distinct assignee.** Every item in this listing is
  assigned to the viewer (directly or through one of their groups), so a
  single option could exclude nothing; two or more mean the viewer holds
  items through several identities, or shares items with colleagues, and
  the filter separates them. The board page keeps its own rule (offered
  whenever any item has an assignee), where a single option still
  excludes the unassigned items.

- **A group-by dropdown on my-items**, in the same `Select` shape the
  board header uses, offering: **by board** (the default, today's
  behavior), **not grouped**, **by due date**, and **by tags**.
  - Grouping by tags puts a multi-tag item into each of its tag groups
    and collects untagged items in a trailing "Untagged" group — the
    semantics board grouping already has.
  - Grouping by due date orders groups by urgency (most overdue first)
    with undated items last.
  - When the grouping is not by board, the table gains a **Board**
    column, so a row still says where it lives.

- Because a group can now span boards, the my-items table stops being
  "one board per table". The listing loads the boards behind its entries
  once, and each row resolves its own board for the status badge, the
  write-access check, and the row menu — which keeps working exactly as
  it does today, in every grouping.

- Both controls live in `MyItemsList`, so the standalone `/my-items` page
  and the boards page's "My items" tab get them together.

## Capabilities

### Modified Capabilities

- `boards/item-management`: the my-items sub-page gains the board page's
  filter bar (with a my-items-specific rule for when the assignee filter
  is offered) and a grouping option, replacing its fixed
  group-by-board rendering.

## Impact

- **`boards`** (frontend only): `MyItemsPage.tsx` gains the filter bar,
  the group-by dropdown, the conditional Board column, and per-row board
  resolution; `grouping.ts` gains the `none` and `tags` my-items grouping
  modes; `queries.ts` gains a multi-board query; `BoardFilterBar.tsx`
  becomes `ItemFilterBar.tsx` with one new optional prop.
- **No backend, API, or `boards-common` change.** `ItemFilter` already
  carries text, tags and assignees with exactly the semantics needed, and
  `GET /my-items` already returns every field the filters read, with the
  page holding the full result client-side — so filtering and grouping
  happen in the browser with no extra request.
- **No change** to the board page's own filter behavior: the rename is
  mechanical and its tests stay untouched as the regression check.
- **No change** to the home page "Assigned items" widget: its grouping
  setting keeps its current three values, even though the underlying
  grouping type widens.

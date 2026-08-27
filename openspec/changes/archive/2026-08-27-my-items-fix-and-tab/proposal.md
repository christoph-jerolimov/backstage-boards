# Fix My Items and Add a Boards-Page Tab

## Why

My items appears empty for items assigned through the catalog pickers:
the dev guest signs in as `user:development/guest`, while every picker
assigns the catalog user `user:default/guest` — the refs never match.
My items is also hidden behind a separate page.

## What Changes

- The dev guest provider resolves to the catalog user
  (`userEntityRef: user:default/guest`), so picker assignments, "Me"
  quick-assigns, and group assignments all match the signed-in user.
- New regression tests: a router-level test for `GET /my-items` and a
  service test asserting that exactly the principal's user/ownership
  refs match.
- The Boards page gets a "My items" tab next to Favorites and All,
  rendering the same list as the standalone page (extracted
  `MyItemsList` component).

## Impact

- `app-config.yaml` guest provider; `boards-backend` router test;
  `plugins/boards` MyItemsPage split + BoardListPage tab.

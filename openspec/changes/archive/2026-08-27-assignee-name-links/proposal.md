# Assignee Name Links to the Catalog

## Why

For a single assignee the card and table show the avatar (which links
to the catalog) next to the display name — but the name itself is plain
text, although it is the bigger click target.

## What Changes

- The single-assignee display name in cards and the table links to the
  catalog entity, like the avatar. The click does not open the item
  drawer (propagation stopped, as for the avatar stack).

## Impact

- `plugins/boards`: single-assignee rendering in `AssigneeAvatars`.

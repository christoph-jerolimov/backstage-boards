# Assignee Option in the Item Menu

## Why

Assigning someone requires opening the drawer. The most common cases —
"assign to me" and "assign to someone already working on this board" —
should be one menu click.

## What Changes

- The item menu gains an "Assignee" submenu: "Me" first, then every
  assignee that appears on any other item of the same board (sorted,
  current user deduplicated). Entries toggle: a ✓ marks assignees
  already on the item; clicking adds or removes them.

## Impact

- `plugins/boards`: `BoardActions.setAssignees`, assignee pool threaded
  from the views into `ItemMenu`, current user via the identity API.

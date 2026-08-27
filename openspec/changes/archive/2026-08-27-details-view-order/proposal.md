# Details View Order

## Why

The drawer buries the most-used context: status, due date, and
assignees appear below the description, and the watch/delete row sits
at the very bottom above the activity feed.

## What Changes

- New order: title → watch/delete row → status, due date, assignees →
  description → labels and tags → created/updated metadata →
  history/comments. Pure reordering, no behavior changes.

## Impact

- `plugins/boards`: block order in `ItemDrawer.tsx`.

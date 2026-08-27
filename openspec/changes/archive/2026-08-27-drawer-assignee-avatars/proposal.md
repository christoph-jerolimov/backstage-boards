# Assignee Avatars in the Details Drawer

## Why

Since the board and table show assignee avatars, the item details drawer
is the odd one out: its assignee chips are text-only.

## What Changes

- Each `user:`/`group:` assignee chip in the drawer shows the assignee's
  avatar (catalog picture or initials) next to the linked display name,
  reusing the existing `AssigneeAvatars` component. `text:` assignees
  stay text-only.

## Impact

- `plugins/boards`: assignee chip rendering in `ItemDrawer.tsx`.

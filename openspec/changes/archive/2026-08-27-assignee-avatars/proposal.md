# Assignee Avatars

## Why

Assignees are currently rendered as plain text badge chips in the kanban
cards and the table view. Avatars make it much faster to scan who works on
what, and they give catalog users and groups a visual identity (profile
picture where the catalog has one, initials otherwise).

## What Changes

- `user:` and `group:` assignees render as avatars in the kanban board
  cards and in the table view's assignee column.
- A single assignee renders as avatar plus display name.
- Multiple assignees render as an overlapping avatar stack; each avatar
  shows the assignee's name in a tooltip and gets a hover effect (raise +
  scale) that makes the click target obvious. Clicking an avatar navigates
  to the catalog entity page.
- Display names and profile pictures come from the catalog
  (`spec.profile.displayName` / `spec.profile.picture`, falling back to
  entity title/name and generated initials).
- `text:` assignees keep the existing badge chip rendering.

## Impact

- `plugins/boards`: new `AssigneeAvatars` component; `KanbanView` and
  `TableView` use it instead of `RefChips` for assignees.
- No backend or API changes.

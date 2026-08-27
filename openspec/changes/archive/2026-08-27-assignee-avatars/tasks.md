# Tasks

## 1. Implementation

- [x] 1.1 `AssigneeAvatars` component with catalog profile resolution,
      single avatar+name, overlapping multi-avatar stack with tooltips,
      hover effect, entity links, and `text:` badge fallback
- [x] 1.2 Use it for assignees in `KanbanView` cards and `TableView`

## 2. Verification

- [x] 2.1 `yarn tsc`, unit tests, lint
- [x] 2.2 Playwright smoke: single assignee shows avatar + name, multiple
      assignees show overlapping avatars with tooltip names
